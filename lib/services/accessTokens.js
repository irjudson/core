var async = require('async')
  , core = require('../../lib')
  , crypto = require('crypto')
  , jwt = require('jsonwebtoken')
  , moment = require('moment')
  , mongoose = require('mongoose');

var cacheKeyToken = function(token) {
    return "token." + token;
};

var clearTokenCacheEntry = function(token, callback) {
    var cacheKey = cacheKeyToken(token);
    core.log.debug('accessTokens: clearing cache entry ' + cacheKey);

    core.config.cache_provider.del('accessTokens', cacheKey, callback);
};

var create = function(principal, options, callback) {
    core.log.debug('accesstokens: creating accesstoken for principal: ' + principal.id);

    if (typeof(options) === "function") {
        callback = options;
        options = {};
    }

    var expiration = moment().add(core.config.access_token_lifetime, 'days');
    if (options.expires) {
        expiration = moment(new Date(options.expires));
    }

    var accessToken = new core.models.AccessToken({
        expires_at: expiration,
        principal: principal
    });

    accessToken.token = jwt.sign({
        iss: principal.id
    }, core.config.access_token_signing_key, { expiresInMinutes: (expiration.milliseconds() - moment().milliseconds())/(1000 * 60) });

    accessToken.save(callback);
};

var find = function(query, options, callback) {
    core.models.AccessToken.find(query, null, options, callback);
};

var findByPrincipal = function(principal, callback) {
    find({ principal: principal.id }, { sort: { expires_at: -1 } }, callback);
};

var findByTokenCached = function(token, callback) {
    var cacheKey = cacheKeyToken(token);

    core.config.cache_provider.get('accessTokens', cacheKey, function(err, accessTokenObj) {
        if (err) return callback(err);
        if (accessTokenObj) {
            core.log.debug("accessTokens: " + cacheKey + ": cache hit");
            var accessToken = new core.models.AccessToken(accessTokenObj);

            // Mongoose by default will override the passed id with a new unique one.  Set it back.
            accessToken._id = mongoose.Types.ObjectId(accessTokenObj.id);

            return callback(null, accessToken);
        }

        core.log.debug("accessTokens: " + cacheKey + ": cache miss.");

        // find and cache result
        return findByToken(token, callback);
    });
};

var findByToken = function(token, callback) {
    core.models.AccessToken.findOne({
        token: token
    }, function(err, accessToken) {
        if (err) return callback(err);
        if (!accessToken) return callback(null, undefined);

        var cacheKey = cacheKeyToken(token);

        core.log.debug("accessTokens: setting cache entry for " + cacheKey);
        core.config.cache_provider.set('accessTokens', cacheKey, accessToken, accessToken.expires_at, function(err) {
            return callback(err, accessToken);
        });

    });
};

var findOrCreateToken = function(principal, callback) {
    findByPrincipal(principal, function(err, tokens) {
        if (err) return callback(err);

        if (tokens && tokens.length > 0) {
            core.log.debug('accesstokens: found existing accesstoken for principal: ' + JSON.stringify(tokens[0]));
        }

        if (tokens && tokens.length > 0 && !isCloseToExpiration(tokens[0])) {
            return callback(null, tokens[0]);
        } else {
            create(principal, function(err, accessToken) {
                if (err) return callback(err);

                callback(null, accessToken);
            });
        }
    });
};

// an access token is close to expiration if less than 10% of its original life exists.
var isCloseToExpiration = function(accessToken) {
    return accessToken.secondsToExpiration() < core.config.refresh_token_threshold * core.config.access_token_lifetime * 24 * 60 * 60;
};

var remove = function(query, callback) {
    find(query, {}, function(err, accessTokens) {
        if (err) return callback(err);

        // remove all matches from cache before removal
        async.eachLimit(accessTokens, 20, function(accessToken, cb) {
            clearTokenCacheEntry(accessToken.token, cb);
        }, function(err) {
            if (err) return callback(err);

            core.models.AccessToken.remove(query, callback);
        });
    });
};

var removeByPrincipal = function(principal, callback) {
    remove({ principal: principal._id }, callback);
};

var verify = function(token, done) {
    jwt.verify(token, core.config.access_token_signing_key, function(err, jwtToken) {
        if (err) return done(err);

        core.services.principals.findByIdCached(core.services.principals.servicePrincipal, jwtToken.iss, function(err, principal) {
            if (err) return done(err);
            if (!principal) {
                var msg = "AccessToken service.verify: principal for accessToken " + token + " with id " + jwtToken.iss + " not found.";
                core.log.error(msg);
                return done(new Error(msg));
            }

            principal.jwtToken = jwtToken;
            done(null, principal);
        });
    });
};

module.exports = {
    create: create,
    findByPrincipal: findByPrincipal,
    findByToken: findByToken,
    findByTokenCached: findByTokenCached,
    findOrCreateToken: findOrCreateToken,
    isCloseToExpiration: isCloseToExpiration,
    remove: remove,
    removeByPrincipal: removeByPrincipal,
    verify: verify
};
