var async = require('async')
  , core = require('../lib');

exports.up = function(callback) {
    var permissions = [
        // disallow anyone else from sending 'ip' messages.
        core.services.permissions.translate({
            action: 'send',
            filter: '{ "type": "ip" }',
            authorized: false,
            priority: 550
        }),

        /* userland permissions exist between priority 1M-2B */

        // if no other higher priority rules allow it, do not allow messages to be sent to: a principal.
        core.services.permissions.translate({
            action: 'send',
            filter: '{ "to": { "$ne": null } }',
            authorized: false,
            priority: core.models.Permission.DEFAULT_PRIORITY_BASE + 500
        }),

        // if no other higher priority rules forbid it, allow messages to be sent.
        core.services.permissions.translate({
            action: 'send',
            authorized: true,
            priority: core.models.Permission.DEFAULT_PRIORITY_BASE + 1000
        }),

        // all principals are allowed to message the service
        core.services.permissions.translate({
            principal_for: 'service',
            action: 'send',
            authorized: true,
            priority: 510
        })
    ];

    async.each(permissions, function(permission, cb) {
        core.services.permissions.create(core.services.principals.servicePrincipal, permission, cb);
    }, callback);
};

// exports.down = function(callback) {
//    callback();
// };
