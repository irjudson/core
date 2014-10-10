var core = require('../../lib')
  , crypto = require('crypto');

var create = function(principalId, callback) {
    core.services.principals.findByIdCached(core.services.principals.servicePrincipal, principalId, function(err, principal) {
        if (err) return callback(err);
        if (!principal) return callback(core.utils.notFoundError("Principal " + principalId + " not found."));

        core.log.info('nonce: creating nonce for principal: ' + principalId);

        var nonce = new core.models.Nonce({
            principal: principal
        });

        crypto.randomBytes(core.config.nonce_bytes, function(err, nonceBuf) {
            if (err) return callback(err);

            nonce.nonce = nonceBuf.toString('base64');
            nonce.save(function(err) {
                return callback(err, nonce);
            });
        });
    });
};

var find = function(query, options, callback) {
    core.models.Nonce.find(query, null, options, callback);
};

var remove = function(query, callback) {
    core.models.Nonce.remove(query, callback);
};

module.exports = {
    create:          create,
    find:            find,
    remove:          remove
};