var core = require('../../lib')
  , crypto = require('crypto');

var create = function(authCode, callback) {
    crypto.randomBytes(core.config.auth_code_bytes, function(err, authCodeBuf) {
        if (err) return callback(err);

        authCode.code = authCodeBuf.toString('base64');
        authCode.save(function(err) {
            return callback(err, authCode);
        });
    });
};

var check = function(code, user, callback) {
    find({ code: code }, {}, function(err, authCodes) {
        if (err) return callback(err);
        if (authCodes.length === 0) return callback(core.utils.badRequestError('authCode not found.'));

        var authCode = authCodes[0];

        if (!authCode.user.equals(user.id)) return callback(core.utils.badRequestError('authCode for different user.'));
        return callback(null, authCode);
    });
};

var find = function(query, options, callback) {
   core.models.AuthCode.find(query, null, options, callback);
};

var remove = function(query, callback) {
   core.models.AuthCode.remove(query, callback);
};

module.exports = {
    check:           check,
    create:          create,
    find:            find,
    remove:          remove
};