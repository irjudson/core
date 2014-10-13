var assert = require('assert')
  , core = require('../../lib')
  , lib = require('../../lib')
  , moment = require('moment');

describe('subscriptions service', function() {
    it('creating a subscription should create row', function(done) {
        core.services.subscriptions.findByPrincipalCached(core.fixtures.models.principals.device, core.fixtures.models.principals.device.id, {}, function(err, subscriptions) {
            assert(!err);

            var cachedCount = subscriptions.length;

            core.models.Subscription.count({}, function(err, startingCount) {
                assert(!err);

                var subscription = new core.models.Subscription({
                    filter: {},
                    name: 'named',
                    principal: core.fixtures.models.principals.device.id,
                    type: 'message',
                    permanent: false,
                    name: core.utils.uuid()
                });

                core.services.subscriptions.findOrCreate(subscription, function(err, subscription) {
                    assert(!err);

                    core.config.cache_provider.get('subscriptions', "subscriptions.principal." + core.fixtures.models.principals.device.id.toString(), function(err, subscriptionObjs) {
                        assert(!err);
                        assert(!subscriptionObjs);
                    });

                    core.models.Subscription.count({}, function(err, endingCount) {
                        assert(!err);

                        assert.equal(startingCount + 1, endingCount);

                        core.services.subscriptions.findByPrincipalCached(core.fixtures.models.principals.device, core.fixtures.models.principals.device.id, {}, function(err, subscriptions) {
                            assert(!err);

                            assert.equal(cachedCount + 1, subscriptions.length);

                            core.config.cache_provider.get('subscriptions', "subscriptions.principal." + core.fixtures.models.principals.device.id.toString(), function(err, subscriptionObjs) {
                                assert(!err);
                                assert(subscriptionObjs.length);

                                core.log.info('removing subscription: ' + subscription.id);
                                core.services.subscriptions.remove(subscription, function(err) {
                                    assert(!err);

                                    core.config.cache_provider.get('subscriptions', "subscriptions.principal." + core.fixtures.models.principals.device.id.toString(), function(err, subscriptionObjs) {
                                        assert(!err);
                                        assert(!subscriptionObjs);

                                        core.services.subscriptions.findByPrincipalCached(core.fixtures.models.principals.device, core.fixtures.models.principals.device.id, {}, function(err, subscriptions) {
                                            assert(!err);
                                            assert.equal(cachedCount, subscriptions.length);

                                            done();
                                        });
                                    });
                                })
                            });
                        });
                    });
                });
            });

        });
    });

    it('can correctly create and then find by principal with cache', function(done) {
        var subscription = new core.models.Subscription({
            clientId: "fakeclientid",
            filter: { type: 'ip' },
            principal: core.services.principals.servicePrincipal.id,
            type: 'message',
            permanent: false,
            name: core.utils.uuid()
        });

        // cache no subscriptions
        core.services.subscriptions.findByPrincipal(core.services.principals.servicePrincipal, core.services.principals.servicePrincipal.id, {}, function(err, subscriptions) {
            assert(!err);

            // add a subscription, which should invalidate cache entry
            core.services.subscriptions.findOrCreate(subscription, function(err, createdSubscription) {
                assert(!err);

                core.services.subscriptions.findByPrincipal(core.services.principals.servicePrincipal, core.services.principals.servicePrincipal.id, {}, function(err, subscriptions) {
                    assert(!err);

                    subscriptions.forEach(function(subscription) {
                        if (subscription.id === createdSubscription.id)
                            done();
                    });
                });
            });
        });
    });

    it('can create a session subscription and receive messages from it', function(done) {
        var subscription = new core.models.Subscription({
            clientId: "fakeclientid",
            filter: { type: 'ip' },
            principal: core.services.principals.servicePrincipal.id,
            type: 'message',
            permanent: false,
            name: core.utils.uuid()
        });

        core.services.subscriptions.findOrCreate(subscription, function(err, subscription) {
            assert(!err);

            var publishFinished;
            core.config.pubsub_provider.receive(subscription, function(err, message) {

                assert(!err);
                assert.notEqual(message, undefined);
                assert.equal(message.type, 'ip');

                //var totalTime = new Date().getTime() - publishFinished.getTime();
                //assert(totalTime < 200);

                core.config.pubsub_provider.subscriptionsForServer(subscription.assignment, function(err, subscriptions) {
                    assert(!err);
                    var startingSubscriptions = subscriptions.length;

                    core.config.pubsub_provider.removeSubscription(subscription, function(err) {
                        assert(!err);

                        core.config.pubsub_provider.subscriptionsForServer(subscription.assignment, function(err, subscriptions) {
                            assert(!err);

                            assert.equal(1, startingSubscriptions - subscriptions.length);
                            done();
                        });
                    });
                });
            });

            var message = new core.models.Message({
                from: core.services.principals.servicePrincipal,
                type: "_test",
                body: { reading: 5.1 }
            });

            var startPublish = new Date();

            core.services.messages.create(core.services.principals.servicePrincipal, message, function(err) {
                assert(!err);
                publishFinished = new Date();

                //var totalTime = publishFinished.getTime() - startPublish.getTime();
                //assert(totalTime < 800);

                var message = new core.models.Message({
                    from: core.services.principals.servicePrincipal,
                    type: "ip",
                    body: { ip_address: "127.0.0.1" }
                });

                core.services.messages.create(core.services.principals.servicePrincipal, message, function(err) {
                    publishFinished = new Date();
                    assert(!err);
                });
            });
        });
    });

    if (core.config.pubsub_provider.SUPPORTS_PERMANENT_SUBSCRIPTIONS) {
        it('permanent subscriptions should queue messages for later', function(done) {
            var subscription = new core.models.Subscription({
                filter: { type: '_permanentQueueTest' },
                name: 'permanent',
                permanent: true,
                principal: core.services.principals.servicePrincipal.id,
                type: 'message'
            });

            core.services.subscriptions.findOrCreate(subscription, function(err, subscription) {
                assert.ifError(err);
                assert(subscription.permanent);

                var msg = new core.models.Message({
                    type: '_permanentQueueTest',
                    from: core.services.principals.servicePrincipal.id,
                    body: {
                        seq: 1
                    }
                });

                // create a message
                core.services.messages.create(core.services.principals.servicePrincipal, msg, function(err) {
                    assert.ifError(err);

                    // create an irrelevant message
                    msg.type = '_anotherType';
                    core.services.messages.create(core.services.principals.servicePrincipal, msg, function(err) {
                        assert.ifError(err);

                        // create a 2nd message
                        msg.body.seq = 2;
                        msg.type = '_permanentQueueTest';
                        core.services.messages.create(core.services.principals.servicePrincipal, msg, function(err) {
                            assert.ifError(err);

                            // receive messages and make sure we get both and in order and they are relevant.
                            core.services.subscriptions.receive(subscription, function(err, message, ref) {
                                assert.ifError(err);

                                assert.equal(message.type, '_permanentQueueTest');
                                assert.equal(message.body.seq, 1);

                                config.pubsub_provider.ackReceive(ref, true);

                                core.services.subscriptions.receive(subscription, function(err, message, ref) {
                                    assert.ifError(err);
                                    assert.equal(message.type, '_permanentQueueTest');
                                    assert.equal(message.body.seq, 2);

                                    core.config.pubsub_provider.ackReceive(ref, true);

                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });
    }

    it('running the janitor should remove abandoned session subscriptions', function(done) {
        var permSub = new core.models.Subscription({
            assignment: 'localhost',
            clientId: "5",
            filter: {},
            name: "janitorTest",
            permanent: true,
            principal: core.services.principals.servicePrincipal,
            type: "message",
            last_receive: moment().add('days', -5).toDate()
        });

        core.services.subscriptions.findOrCreate(permSub, function(err, permSub) {
            assert.ifError(err);

            var sessionSub = new core.models.Subscription({
                clientId: "5",
                filter: {},
                principal: core.services.principals.servicePrincipal,
                type: "message",
                permanent: false,
                name: core.utils.uuid(),
                last_receive: moment().add('days', -5).toDate()
            });

            core.services.subscriptions.findOrCreate(sessionSub, function(err, sessionSub) {
                assert.ifError(err);

                core.models.Subscription.count({}, function(err, startingCount) {
                    assert.ifError(err);

                    core.services.subscriptions.janitor(function(err) {
                        assert.ifError(err);

                        core.models.Subscription.count({}, function(err, endingCount) {
                            assert.ifError(err);

                            assert.equal(startingCount, endingCount + 1);
                            done();
                        });
                    });
                });
            });
        });
    });
});
