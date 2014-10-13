var async = require('async')
  , assert = require('assert')
  , fs = require('fs')
  , core = require('../../lib');

var fixtures = {};

var createApiKeyFixtures = function(callback) {
    var adminKey = new core.models.ApiKey({
        name: 'Admin',
        type: 'app',
        capabilities: ['impersonate'],
        redirect_uri: 'http://localhost:9000/',
        owner: core.services.principals.servicePrincipal.id
    });

    core.services.apiKeys.create(core.services.principals.servicePrincipal, adminKey, function(err, adminKey) {
        if (err) throw err;

        fixtures.apiKeys.admin = adminKey;

        var regularAppKey = new core.models.ApiKey({
            name: 'Regular App',
            type: 'app',
            capabilities: [],
            redirect_uri: 'http://localhost:9000/',
            owner: fixtures.principals.anotherUser.id
        });

        core.services.apiKeys.create(core.services.principals.servicePrincipal, regularAppKey, function(err, regularAppKey) {
            if (err) throw err;

            fixtures.apiKeys.regularApp = regularAppKey;

            return callback();
        });
    });
};

var createAppFixtures = function(callback) {
    core.log.debug("creating app fixture");

    var app = new core.models.Principal({
        type: 'app',
        api_key: fixtures.apiKeys.regularApp,
    });

    core.services.principals.createSecret(app, function(err, app) {
        if (err) throw err;

        core.services.principals.create(app, function(err, app) {
            if (err) throw err;

            fixtures.principals.app = app;

            return callback();
        });
    });
};

var createAuthCodeFixtures = function(callback) {
    core.log.debug("creating authCode fixture");

    var authCode = core.models.AuthCode({
        api_key: fixtures.apiKeys.regularApp,
        app: fixtures.principals.app.id,
        name: fixtures.apiKeys.regularApp.name,
        user: fixtures.principals.user.id,
        scope: '[]',
        redirect_uri: fixtures.apiKeys.regularApp.redirect_uri
    });

    core.services.authCodes.create(authCode, function(err, authCode) {
        fixtures.authCodes.regularApp = authCode;

        return callback();
    });
};

var createSecretAuthDeviceFixtures = function(callback) {
    var secretAuthDevice = new core.models.Principal({
        api_key: fixtures.apiKeys.user,
        type: 'device',
        name: 'secretAuthDevice'
    });

    core.services.principals.createSecret(secretAuthDevice, function(err, secretAuthDevice) {
        if (err) return callback(err);

        var secret = secretAuthDevice.secret;

        core.services.principals.create(secretAuthDevice, function(err, secretAuthDevice) {
            if (err) return callback(err);

            secretAuthDevice.secret = secret;
            fixtures.principals.secretAuthDevice = secretAuthDevice;

            return callback();
        });
    });
};

var createDeviceFixtures = function(callback) {
    core.log.debug("creating device fixtures");

    var device = new core.models.Principal({
        api_key: fixtures.apiKeys.user,
        type: 'device',
        name: 'existing device'
    });

    core.services.principals.createSecret(device, function(err, device) {
        if (err) throw err;

        core.services.principals.create(device, function(err, device) {
            if (err) throw err;

            var userIsDeviceAdmin = new core.models.Permission({
                authorized: true,
                issued_to: fixtures.principals.user.id,
                principal_for: device.id,
                priority: core.models.Permission.DEFAULT_PRIORITY_BASE
            });

            core.services.permissions.create(core.services.principals.servicePrincipal, userIsDeviceAdmin, function(err) {
                if (err) throw err;

                core.services.principals.updateLastConnection(device, '127.0.0.1');

                fixtures.principals.device = device;

                core.services.accessTokens.create(device, function(err, accessToken) {
                    if (err) throw err;

                    // make access token expire in 15 minutes to force an accessToken refresh
                    var updates = { expires_at: new Date(new Date().getTime() + (15 * 60000))};
                    core.models.AccessToken.update({ _id: accessToken.id }, { $set: updates }, function (err, updateCount) {
                        fixtures.accessTokens.device = accessToken;
                        core.log.debug("creating device fixtures: FINISHED: " + updates.expires_at);
                        callback();
                    });
                });
            });
        });
    });
};

var createServiceUserFixtures = function(callback) {
    core.log.debug("creating service user fixtures");
    core.services.accessTokens.findOrCreateToken(core.services.principals.servicePrincipal, function(err, accessToken) {
        if (err) throw err;

        fixtures.accessTokens.service = accessToken;
        core.log.debug("creating service user fixtures: FINISHED");
        callback();
    });
};

var createUserFixtures = function(callback) {
    core.log.debug("creating user fixtures");

    var user = new core.models.Principal({
        type: 'user',
        email: 'user@server.org',
        password: 'sEcReT44'
    });

    core.services.principals.create(user, function(err, user) {
        if (err) throw err;

        fixtures.principals.user = user;

        core.services.apiKeys.find({ owner: user.id }, {}, function(err, apiKeys) {
            if (err) throw err;
            assert(apiKeys.length > 0);

            fixtures.apiKeys.user = apiKeys[0];
        });

        core.services.accessTokens.create(user, function(err, accessToken) {
            if (err) throw err;

            fixtures.accessTokens.user = accessToken;

            var anotherUser = new core.models.Principal({
                type: 'user',
                email: 'anotheruser@server.org',
                password: 'sEcReTO66'
            });

            core.services.principals.create(anotherUser, function(err, user) {
                if (err) throw err;

                fixtures.principals.anotherUser = anotherUser;

                core.services.apiKeys.find({ owner: anotherUser.id }, {}, function(err, apiKeys) {
                    if (err) throw err;
                    fixtures.apiKeys.anotherUser = apiKeys[0];
                });

                var userCanImpersonateAnotherUser = new core.models.Permission({
                    authorized: true,
                    issued_to: fixtures.principals.user.id,
                    principal_for: fixtures.principals.anotherUser.id,
                    action: 'impersonate',
                    priority: core.models.Permission.DEFAULT_PRIORITY_BASE
                });

                core.services.permissions.create(core.services.principals.servicePrincipal, userCanImpersonateAnotherUser, function(err) {
                    if (err) throw err;

                    core.services.accessTokens.create(anotherUser, function(err, accessToken) {
                        if (err) throw err;

                        fixtures.accessTokens.anotherUser = accessToken;

                        core.log.debug("creating user fixtures: FINISHED");
                        callback();
                    });
                });
            });
        });
    });
};

var createBlobFixture = function(callback) {
    core.log.debug("creating blob fixtures");

    var fixture_path = 'test/fixtures/images/image.jpg';

    fs.stat(fixture_path, function(err, stats) {
        if (err) throw err;

        var blob = new core.models.Blob({
            content_type: "image/jpeg",
            content_length: stats.size
        });

        var stream = fs.createReadStream(fixture_path);
        core.services.blobs.create(fixtures.principals.user, blob, stream, function(err, blob) {
            if (err) throw err;

            fixtures.blobs.removableBlob = blob;

            core.log.debug("creating blob fixtures: FINISHED");

            callback();
        });
    });
};

var createDeviceIpMessageFixture = function(callback) {
    core.log.debug("creating device ip fixtures");

    var message = new core.models.Message({ from: fixtures.principals.device.id,
                                       type: "ip",
                                       index_until: new Date(new Date().getTime() + 24 * 60 * 60 + 1000),
                                       body: { ip_address: "127.0.0.1" } });

    core.services.messages.create(core.services.principals.servicePrincipal, message, function (err, messages) {
        if (err) throw err;

        fixtures.messages.deviceIp = messages[0];
        core.log.debug("creating device ip fixtures: FINISHED");
        callback();
    });
};

exports.reset = function(callback) {
    var fixtureFactories = [
        createUserFixtures,
        createDeviceFixtures,
        createDeviceIpMessageFixture,
        createSecretAuthDeviceFixtures,
        createServiceUserFixtures,
        createApiKeyFixtures,
        createAppFixtures,
        createAuthCodeFixtures
    ];

    if (core.config.blob_provider) {
        fixtureFactories.push(createBlobFixture);
    }

    async.series(fixtureFactories, callback);
};

var fixtures = {
    accessTokens: {},
    apiKeys: {},
    authCodes: {},
    blobs: {},
    messages: {},
    principals: {}
};

exports.models = fixtures;