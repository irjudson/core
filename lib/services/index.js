var async = require('async');

exports.accessTokens        = require('./accessTokens');
exports.apiKeys             = require('./apiKeys');
exports.authCodes           = require('./authCodes');
exports.blobs               = require('./blobs');
exports.email               = require('./email');
exports.global              = require('./global');
exports.messages            = require('./messages');
exports.nonce               = require('./nonce');
exports.permissions         = require('./permissions');
exports.principals          = require('./principals');
exports.subscriptions       = require('./subscriptions');

exports.initialize = function(callback) {
    async.series([
        exports.principals.initialize,
        exports.global.migrate,
        exports.messages.initialize,
        exports.blobs.initialize,
        exports.permissions.initialize,
        exports.subscriptions.initialize,
        exports.apiKeys.initialize,

        exports.global.startJanitor
    ], callback);
};