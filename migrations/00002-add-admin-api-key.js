var async = require('async')
  , core = require('../lib');

exports.up = function(callback) {
    var adminApiKey = core.models.ApiKey({
        capabilities: ['impersonate'],
        enabled : true,
        key: "admin",
        name : "Web Admin",
        redirect_uri: core.config.web_admin_uri,
        type: "app",
        owner : core.services.principals.servicePrincipal
    });

    core.services.apiKeys.create(core.services.principals.servicePrincipal, adminApiKey, callback);
};

// exports.down = function(callback) {
//    callback();
// };
