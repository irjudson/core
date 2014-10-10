var assert = require('assert')
  , core = require('../../lib')
  , crypto = require('crypto')
  , fixtures = require('../fixtures');

describe('principals service', function() {
    var passwordFixture = "sEcReT44";

    it('can create and validate a user', function(done) {
        var user = new core.models.Principal({
            type: "user",
            email: "user@gmail.com",
            password: passwordFixture
        });

        core.services.principals.create(user, function(err, user) {
            assert(!err);
            assert.notEqual(user.id, undefined);
            assert.notEqual(user.visible_to, undefined);
            assert.notEqual(user.visible_to.length, 0);
            assert.notEqual(user.password_hash, undefined);
            assert.notEqual(user.password_hash, passwordFixture);
            assert.equal(user.email, "user@gmail.com");

            var principalJson = user.toJSON();
            assert.equal(principalJson.password_hash, undefined);
            assert.equal(principalJson.salt, undefined);

            core.services.principals.verifyPassword(passwordFixture, user, function(err) {
                assert(!err);

                core.services.principals.verifyPassword("NOTCORRECT", user, function(err) {
                     assert(err);

                     core.services.apiKeys.find({ owner: user.id }, {}, function(err, apiKeys) {
                        assert(!err);

                        assert(apiKeys.length === 1);
                        assert.equal(apiKeys[0].owner, user.id);

                        done();
                     });
                });
            });
        });
    });

    it('can create an app', function(done) {
        var app = new core.models.Principal({
            type: "app",
            nickname: 'app',
            api_key: fixtures.models.apiKeys.user
        });

        core.services.principals.createSecret(app, function(err, app) {
            assert(!err);

            core.services.principals.create(app, function(err, app) {
                assert(!err);
                assert(app.id);

                done();
            });
        });
    });

    it('can create and validate a device', function(done) {
        var device = new core.models.Principal({
            type: "device",
            api_key: fixtures.models.apiKeys.user,
        });

        core.services.principals.createSecret(device, function(err, device) {
            assert(!err);

            core.services.principals.create(device, function(err, device) {
                assert(!err);

                console.dir(device);

                assert(device.id);
                assert(!device.secret);
                assert(device.secret_hash);

                done();
            });
        });
    });

    it('can generate a claim code', function(done) {
        var code = core.services.principals.generateClaimCode();
        assert.notEqual(code, undefined);
        assert.equal(code.length, core.config.claim_code_length + 1);

        done();
    });

    it('service can update name', function(done) {
        fixtures.models.principals.device.name = 'my camera';
        core.services.principals.update(core.services.principals.servicePrincipal, fixtures.models.principals.device.id, { name: "my camera"}, function(err, principal) {
            assert.ifError(err);
            assert.equal(principal.name, 'my camera');

            done();
        });
    });

    it('service can update visible_to', function(done) {
        fixtures.models.principals.device.name = 'my camera';

        fixtures.models.principals.device.visible_to.push("52747742e2948d8e7f000001");

        core.services.principals.update(core.services.principals.servicePrincipal, fixtures.models.principals.device.id,
            { visible_to: fixtures.models.principals.device.visible_to }, function(err, updatedPrincipal) {
            assert.ifError(err);

            var foundPrincipal = false;
            updatedPrincipal.visible_to.forEach(function(principalId) {
                if (principalId.toString() === "52747742e2948d8e7f000001")
                    foundPrincipal = true;
            });

            assert(foundPrincipal);
            done();
        });
    });

    it("a user principal can update a principal's name", function(done) {
        core.services.principals.update(fixtures.models.principals.user, fixtures.models.principals.user.id, { name: "Joe User" }, function(err, principal) {
            assert.ifError(err);
            assert.equal(principal.name, "Joe User");
            done();
        });
    });

    it('should reject creating a user without an email', function(done) {
        var user = new core.models.Principal({
            type: 'user',
            password: fixtures.models.principals.user.password
        });

        core.services.principals.create(user, function(err, user) {
            assert.equal(!!err, true);
            done();
        });
    });

    it('should reject creating a user without a password', function(done) {
        var user = new core.models.Principal({
            type: 'user',
            email: 'newuser@gmail.com'
        });

        core.services.principals.create(user, function(err, user) {
            assert.equal(!!err, true);
            done();
        });
    });

    it('should reject user deleting the service principal', function(done) {
        core.services.principals.removeById(fixtures.models.principals.user, core.services.principals.servicePrincipal.id, function(err) {
            assert.equal(!!err, true);
            done();
        });
    });

    it('should allow device deleting itself', function(done) {
        core.services.principals.removeById(fixtures.models.principals.device, fixtures.models.principals.device.id, function(err) {
            assert.ifError(err);
            done();
        });
    });

    it('should reject creating a if user that already exists', function(done) {
        var user = new core.models.Principal({
            type: 'user',
            email: fixtures.models.principals.user.email,
            password: fixtures.models.principals.user.password
        });

        core.services.principals.create(user, function(err, user) {
            assert.equal(!err, false);
            done();
        });
    });

    it('can create a user, change its password, and then reset its password.', function(done) {
        var user = new core.models.Principal({
            type: "user",
            email: "changePassword@gmail.com",
            password: "firstPassword"
        });

        core.services.principals.create(user, function(err, user) {
            assert.ifError(err);

            var originalPasswordHash = user.password_hash;

            core.services.accessTokens.findOrCreateToken(user, function(err, accessToken) {
                assert.ifError(err);
                assert.notEqual(accessToken, undefined);

                core.services.accessTokens.findByPrincipal(user, function(err, accessTokens) {
                    assert.ifError(err);

                    core.services.principals.changePassword(user, "anotherPassword", function(err, principal) {
                        assert.ifError(err);
                        assert.notEqual(principal.password_hash, originalPasswordHash);
                        originalPasswordHash = principal.password_hash;

                        core.services.accessTokens.findByPrincipal(user, function(err, accessTokens) {
                            assert.ifError(err);

                            core.services.principals.resetPassword(core.services.principals.servicePrincipal, user, function(err, principal) {
                                assert.ifError(err);
                                assert.notEqual(principal.password_hash, originalPasswordHash);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    it('can find a device by created_at or updated_at', function(done) {
        core.services.principals.find(core.services.principals.servicePrincipal, { created_at: { $gt: new Date(1900, 1, 1) } }, function(err, principals) {
            assert(!err);
            assert(principals.length > 1);

            core.services.principals.find(core.services.principals.servicePrincipal, { updated_at: { $gt: new Date(1900, 1, 1) } }, function(err, principals) {
                assert(!err);
                assert(principals.length > 1);

                done();
            });
        });
    });
});
