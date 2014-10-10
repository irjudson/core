var async = require('async')
  , core = require('../../lib')
  , crypto = require('crypto')
  , redis = require('redis');

var redisClient;

var assign = function(principal, callback) {
    core.models.ApiKey.findOneAndUpdate({ owner: { $exists: false }, type: 'user' }, { $set: { owner: principal.id, name: 'User' } }, function(err, apiKey) {
        if (err) return callback(err);

        // regardless, create a new unassigned key.
        createUnassigned();

        // if we assigned a key, return that.
        if (apiKey) return callback(null, apiKey);

        var apiKey = new core.models.ApiKey({
            name: 'User',
            type: 'user',
            owner: principal.id
        });

        // otherwise, no unassigned keys available, so create an assigned one directly.
        create(core.services.principals.servicePrincipal, apiKey, callback);
    });
};

var check = function(key, redirectUri, callback) {
    if (!redirectUri) return callback(core.utils.badRequestError("redirect_uri " + key + " not provided."));

    find({ key: key }, {}, function(err, apiKeys) {
        if (err) return callback(err);

        if (apiKeys.length === 0) return callback(core.utils.badRequestError("api_key " + key + " not found."));

        var apiKey = apiKeys[0];

        if (!apiKey.enabled) return callback(core.utils.authorizationError("api_key " + key + " is not enabled"));
        if (!core.utils.stringStartsWith(redirectUri, apiKey.redirect_uri)) return callback(core.utils.badRequestError("redirect_uri does not match API Key."));

        return callback(null, apiKey);
    });
};

var create = function(authzPrincipal, apiKey, callback) {
    var validType = false;

    core.models.ApiKey.APIKEY_TYPES.forEach(function(type) {
        validType = validType || apiKey.type === type;
    });

    if (!validType) {
        var err = 'API key type invalid. found: ' + apiKey.type;
        core.log.error(err);
        return callback(core.utils.badRequestError(err));
    }

    if (!apiKey.redirect_uri && apiKey.type === 'app') {
        var err = 'Redirect URI not provided and is required.';
        core.log.error(err);
        return callback(core.utils.badRequestError(err));
    }

    if (authzPrincipal !== core.services.principals.servicePrincipal)
        apiKey.owner = authzPrincipal;

    crypto.randomBytes(core.config.api_key_bytes, function(err, apiKeyBuf) {
        if (err) return callback(err);

        if (!apiKey.key)
            apiKey.key = apiKeyBuf.toString('hex');

        apiKey.save(function(err) {
            // kick off creating a personalized image for this key.

            getRedisClient().rpush('images.build', JSON.stringify({ key: apiKey.key }), function(err) {
                if (callback) return callback(err, apiKey);
            });
        });
    });
};

var createUnassigned = function(callback) {
    core.log.info('apikeys service: creating unassigned key.');
    core.services.apiKeys.create(core.services.principals.servicePrincipal, new core.models.ApiKey({ type: 'user', name: 'User' }), callback);
};

var createAdminKey = function(callback) {
    core.log.info('apikeys service: creating unassigned key.');
    core.services.apiKeys.create(core.services.principals.servicePrincipal, new core.models.ApiKey({
        capabilities: ["impersonate"],
        key: process.env.ADMIN_API_KEY,
        name: 'Web Admin',
        redirect_uri: process.env.ADMIN_REDIRECT_ROOT,
        type: 'app'
    }), callback);
};

var find = function(query, options, callback) {
    core.models.ApiKey.find(query, null, options, callback);
};

var findById = function(id, callback) {
    if (!id) return callback(null, undefined);

    return core.models.ApiKey.findOne({ _id: id }, callback);
};

var findByKey = function(key, callback) {
    if (!key) return callback(null, undefined);

    return core.models.ApiKey.findOne({ key: key }, callback);
};

var getRedisClient = function() {
    if (!redisClient)
        redisClient = redis.createClient(core.config.redis_server.port, core.config.redis_server.host);

    return redisClient;
};

var initialize = function(callback) {
    core.models.ApiKey.find({ owner: { $exists: false }, type: 'user' }, {}, function(err, apiKeys) {
        if (err) return callback(err);

        var required = core.config.unassigned_apikey_pool_size - apiKeys.length;

        if (required > 0) {
            async.times(required, function(n, next) {
                createUnassigned(next);
            }, callback);
        } else {
            return callback();
        }
    });

    if (process.env.ADMIN_API_KEY && process.env.ADMIN_REDIRECT_ROOT) {
        core.models.ApiKey.find({ name: process.env.ADMIN_API_KEY }, {}, function(err, apiKeys) {
            if (err) return callback(err);
            if (apiKeys.length !== 0) return callback();

            createAdminKey(callback);
        });
    }
};

var remove = function(query, callback) {
    core.models.ApiKey.remove(query, callback);
};

module.exports = {
    assign:          assign,
    check:           check,
    create:          create,
    find:            find,
    findById:        findById,
    findByKey:       findByKey,
    initialize:      initialize,
    remove:          remove,
};
