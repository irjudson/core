var async = require('async')
  , core = require('../../lib')
  , moment = require('moment')
  , mongoose = require('mongoose')
  , RedisStore = require('socket.io/lib/stores/redis')
  , redis  = require('socket.io/node_modules/redis');

var io;

var attach = function(server) {
    if (!core.config.pubsub_provider) return core.log.warn('pubsub provider not configured: subscription endpoint not started.');

    io = require('socket.io').listen(server);

    this.pub = createRedisClient();
    this.sub = createRedisClient();
    this.client = createRedisClient();

    io.set('store', new RedisStore({
        redisPub: this.pub,
        redisSub: this.sub,
        redisClient: this.client
    }));

    io.set('log level', 1);

    attachAuthFilter();
    attachSubscriptionsEndpoint();

    core.log.info('listening for realtime connections on ' + core.config.subscriptions_path);
};

var attachAuthFilter = function() {
    io.configure(function () {
        io.set('authorization', function (handshakeData, callback) {
            if (!handshakeData.query.auth) return callback(null, false);

            core.services.accessTokens.verify(handshakeData.query.auth, function(err, principal) {
                var success = !err && principal;

                handshakeData.principal = principal;

                callback(null, success);
            });
        });
    });
};

var attachSubscriptionsEndpoint = function() {
    io.sockets.on('connection', function(socket) {
        if (!socket.handshake.principal) return core.log.error('subscription request without type and/or principal.');

        socket.subscriptions = {};
        socket.on('start', function(spec) {
            core.log.info('subscriptions: starting subscription with spec: ' + JSON.stringify(spec));
            start(socket, spec);
        });

        socket.on('disconnect', function() {
            var subscriptionKeys = Object.keys(socket.subscriptions);
            core.log.info('subscriptions: socket: ' + socket.id + ' disconnected.  stopping ' + subscriptionKeys.length + ' subscriptions on this socket.');

            async.each(subscriptionKeys, function(clientId, callback) {
                stop(socket.subscriptions[clientId], function(err) {
                    delete socket.subscriptions[clientId];

                    return callback(err);
                });
            });
        });

        socket.on('stop', function(spec) {
            core.log.info('subscriptions: stopping subscription with spec: ' + JSON.stringify(spec));
            stop(socket.subscriptions[spec.id], function(err) {
                if (err) log.error(err);

                delete socket.subscriptions[spec.id];
            });
        });

        // Expose message endpoint through socket connection.
        socket.on('messages', function(messageBundle) {
            core.services.messages.createMany(socket.handshake.principal, messageBundle.messages, function(err, messages) {
                socket.emit(messageBundle.uniqueId, {
                    error: err,
                    messages: messages
                });
            });
        });
    });
};

var cacheKeySubscriptionsForPrincipal = function(principalId) {
    return "subscriptions.principal." + principalId.toString();
};

var clearPrincipalSubscriptionsCacheEntry = function(principalId, callback) {
    var cacheKey = cacheKeySubscriptionsForPrincipal(principalId);
    core.log.debug('subscriptions: clearing cache entry ' + cacheKey);

    core.config.cache_provider.del('subscriptions', cacheKey, callback);
};

var count = function(callback) {
    core.models.Subscription.count(callback);
};

var create = function(subscription, callback) {
    core.config.pubsub_provider.createSubscription(subscription, function(err) {
        if (err) callback(err);

        save(subscription, callback);
    });
};

var createRedisClient = function() {
    var firstRedisServerKey = Object.keys(core.config.redis_servers)[0];
    var firstRedisServer = core.config.redis_servers[firstRedisServerKey];

    var redisClient = redis.createClient(firstRedisServer.port, firstRedisServer.host);
    if (firstRedisServer.password) {
        redisClient.auth(firstRedisServer.password, function(err) {
            if (err) core.log.error('redis auth error: ' + err);
        });
    }

    return redisClient;
};

var find = function(authPrincipal, filter, options, callback) {
    core.models.Subscription.find(filter, null, options, callback);
};

var findByPrincipalCached = function(authPrincipal, principalId, options, callback) {
    var cacheKey = cacheKeySubscriptionsForPrincipal(principalId);
    core.config.cache_provider.get('subscriptions', cacheKey, function(err, subscriptionObjs) {
        if (err) return callback(err);
        if (subscriptionObjs) {
            core.log.debug("subscriptions: " + cacheKey + ": cache hit: " + subscriptionObjs.length);
            var subscriptions = subscriptionObjs.map(function(obj) {
                var subscription = new core.models.Subscription(obj);

                // Mongoose by default will override the passed id with a new unique one.  Set it back.
                subscription._id = mongoose.Types.ObjectId(obj.id);

                return subscription;
            });

            return callback(null, subscriptions);
        }

        core.log.debug("subscriptions: " + cacheKey + ": cache miss.");

        // find and cache result
        return findByPrincipal(authPrincipal, principalId, options, callback);
    });
};

var findByPrincipal = function(authPrincipal, principalId, options, callback) {
    var cacheKey = cacheKeySubscriptionsForPrincipal(principalId);

    core.models.Subscription.find({ principal: principalId }, null, options, function(err, subscriptions) {
        if (err) return callback(err);

        core.log.debug("subscriptions: setting cache entry for " + cacheKey + ": " + subscriptions.length);
        core.config.cache_provider.set('subscriptions', cacheKey, subscriptions,  moment().add(1, 'days').toDate(), function(err) {
            return callback(err, subscriptions);
        });
    });
};

var findOne = function(subscription, callback) {
    var filter = {
        principal: subscription.principal,
        type: subscription.type,
        name: subscription.name
    };

    core.models.Subscription.findOne(filter, callback);
};

var findOrCreate = function(subscription, callback) {
    findOne(subscription, function(err, existingSubscription) {
        if (err) return callback(err);
        if (existingSubscription) return callback(null, existingSubscription);

        create(subscription, callback);
    });
};

var initialize = function(callback) {
    core.config.pubsub_provider.services = core.services;
    return callback();
}

var janitor = function(callback) {
    var cutoffTime = core.config.pubsub_provider.staleSubscriptionCutoff();

    find(core.services.principals.servicePrincipal, {
        last_receive: { $lt: cutoffTime },
        permanent: false
    }, function(err, subscriptions) {
        core.log.info('subscriptions: janitoring ' + subscriptions.length + ' abandoned session subscriptions from before: ' + cutoffTime.toString());
        async.each(subscriptions, remove, callback);
    });
};

var publish = function(type, item, callback) {
    if (!core.config.pubsub_provider) return callback(new Error("subscription service: can't publish without pubsub_provider"));

    core.config.pubsub_provider.publish(type, item, callback);
};

var receive = function(subscription, callback) {
    if (!core.config.pubsub_provider) return callback(new Error("subscription service: can't receive without pubsub_provider"));

    // fire and forget an update to tag this subscription with the last attempted receive.
    // used for janitorial purposes for non-permanent subscriptions.
    core.log.debug('subscriptions: updating last_receive for subscription: ' + subscription.id + ': ' + subscription.name + ': ' + subscription.filter_string);

    core.config.pubsub_provider.receive(subscription, callback);

    subscription.last_receive = new Date();
    subscription.save();
    //update(subscription, { last_receive: new Date() });
};

var remove = function(subscription, callback) {
    if (!subscription) return log.error('undefined subscription passed to services.subscription.remove.');

    core.log.debug('subscriptions: removing subscription: ' + subscription.id + ': ' + subscription.name + ': filter: ' + JSON.stringify(subscription.filter) + ' last_receive: ' + subscription.last_receive);

    core.config.pubsub_provider.removeSubscription(subscription, function(err) {
        if (err) log.error('subscriptions: remove failed in provider with error: ' + err);

        subscription.remove(function(err, removedCount) {
            if (err) return callback(err);

            if (subscription.socket)
                delete subscription.socket.subscriptions[subscription.clientId];

            clearPrincipalSubscriptionsCacheEntry(subscription.principal, function(err) {
                return callback(err, removedCount);
            });
        });
    });
};

var save = function(subscription, callback) {
    subscription.save(function(err, subscription) {
        if (err) return callback(err);

        clearPrincipalSubscriptionsCacheEntry(subscription.principal, function(err) {
            return callback(err, subscription);
        });
    });
};

var start = function(socket, spec, callback) {
    var subscription = new core.models.Subscription({
        clientId: spec.id,
        filter: spec.filter || {},
        name: spec.name,
        principal: socket.handshake.principal.id,
        socket: socket,
        type: spec.type
    });

    subscription.permanent = !!subscription.name;
    if (!subscription.permanent) {
        // assign the subscription a uuid as a name if this is session subscription
        subscription.name = core.utils.uuid();
    }

    findOrCreate(subscription, function(err, subscription) {
        if (err) {
            var msg = 'subscriptions: failed to create: ' + err;
            core.log.error(msg);
            if (callback) callback(new Error(msg));
            return;
        }

        core.log.debug('subscriptions: connecting subscription: ' + subscription.id + ' with clientId: ' + spec.id);

        subscription.clientId = spec.id;

        socket.subscriptions[subscription.clientId] = subscription;

        stream(socket, subscription);
        if (callback) return callback(null, subscription);
    });
};

// stop is invoked when an active subscription is closed.
// for permanent subscriptions this is a noop.
// for session subscriptions this removes them.
var stop = function(subscription, callback) {
    if (!subscription) {
        core.log.warn('subscriptions: stop: passed null subscription.');
    }

    if (subscription && !subscription.permanent) {
        remove(subscription, callback);
    } else {
        return callback();
    }
};

var stream = function(socket, subscription) {
    async.whilst(
        function() {
            return socket.subscriptions[subscription.clientId] !== undefined;
        },
        function(callback) {
            receive(subscription, function(err, item, ref) {
                if (err) return callback(err);

                // if the socket has disconnected in the meantime, reject the message.
                if (socket.subscriptions[subscription.clientId] === undefined) {
                    core.log.info('subscription service:  subscription is closed, rejecting message.');
                    core.config.pubsub_provider.ackReceive(ref, false);
                } else {
                    // there might not be an item when the provider timed out waiting for an item.
                    if (item) {
                        core.log.info('subscription service:  new message from subscription: ' + subscription.clientId + ' with name: ' + subscription.name + ' of type: ' + subscription.type + ": " + JSON.stringify(item));
                        socket.emit(subscription.clientId, item);
                    }

                    core.config.pubsub_provider.ackReceive(ref, true);
                }

                callback();
            });
        },
        function(err) {
            if (err) core.log.error("subscription service: receive loop error: " + err);

            core.log.info("subscription service: stream for " + subscription.clientId + " disconnected.");
        }
    );
};

var update = function(subscription, updates, callback) {
    core.models.Subscription.update({ _id: subscription.id }, { $set: updates }, function(err, updateCount) {
        if (err) return callback(err);

        clearPrincipalSubscriptionsCacheEntry(subscription.principal, function(err) {
            return callback(err, updateCount);
        });
    });
};

module.exports = {
    attach: attach,
    count: count,
    create: create,
    find: find,
    findByPrincipal: findByPrincipal,
    findByPrincipalCached: findByPrincipalCached,
    findOne: findOne,
    findOrCreate: findOrCreate,
    initialize: initialize,
    janitor: janitor,
    publish: publish,
    receive: receive,
    remove: remove,
    start: start,
    stop: stop
};
