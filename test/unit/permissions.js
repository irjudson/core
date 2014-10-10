var assert = require('assert')
  , core = require('../../lib')
  , fixtures = require('../fixtures');

describe('permissions service', function() {
    it('checks default permissions', function(done) {
        var message = new core.models.Message({
            type: 'ip'
        });

        core.services.permissions.authorize({
            principal: core.services.principals.servicePrincipal.id,
            action: 'send'
        }, message, function(err, permission) {
            assert.ifError(err);
            assert.equal(permission.authorized, true);

            core.services.permissions.authorize({
                principal: fixtures.models.principals.user.id,
                action: 'send'
            }, message, function(err, permission) {
                assert.ifError(err);
                assert.equal(permission.authorized, false);

                message.type = 'image';
                message.body.url = 'http://to.no.where/';

                core.services.permissions.authorize({
                    principal: fixtures.models.principals.user.id,
                    action: 'send'
                }, message, function(err, permission) {
                    assert.ifError(err);
                    assert.equal(permission.authorized, true);

                    message.to = fixtures.models.principals.device.id;
                    core.services.permissions.authorize({
                        principal: fixtures.models.principals.user.id,
                        action: 'send'
                    }, message, function(err, permission) {
                        assert.ifError(err);
                        assert.equal(permission.authorized, false);
                        done();
                    });
                });
            });
        });
    });

    it('creating a permission updates visible_to and clears caches', function(done) {
        core.services.principals.findById(core.services.principals.servicePrincipal, fixtures.models.principals.anotherUser.id, function(err, anotherUser) {
            assert(!err);

            core.services.permissions.create(core.services.principals.servicePrincipal,
                new core.models.Permission({
                    authorized: true,
                    issued_to: fixtures.models.principals.user.id,
                    principal_for: fixtures.models.principals.anotherUser.id,
                    priority: 50000000
                }),
                function(err, permission) {
                    assert(!err);

                    core.config.cache_provider.get('permissions', fixtures.models.principals.user.id, function(err, permissionObjs) {
                        assert(!err);
                        assert(!permissionObjs);
                    });

                    core.config.cache_provider.get('permissions', fixtures.models.principals.anotherUser.id, function(err, permissionObjs) {
                        assert(!err);
                        assert(!permissionObjs);
                    });

                    core.services.principals.findById(core.services.principals.servicePrincipal, fixtures.models.principals.anotherUser.id, function(err, anotherUser) {
                        assert(!err);

                        var foundUser = false;
                        anotherUser.visible_to.forEach(function(visiblePrincipalId) {
                            if (visiblePrincipalId.toString() === fixtures.models.principals.user.id)
                                foundUser = true;
                        });

                        assert(foundUser);

                        core.services.permissions.permissionsForCached(fixtures.models.principals.user.id, function(err, permissions) {
                            assert(!err);
                            assert(permissions.length);

                            core.config.cache_provider.get('permissions', fixtures.models.principals.user.id, function(err, permissionObjs) {
                                assert(!err);
                                assert(permissionObjs.length);

                                var found = false;
                                permissionObjs.forEach(function(permissionObj) {
                                    found = found || permissionObj.priority === 50000000
                                })

                                assert(found);
                            });
                        });

                        core.services.permissions.removeById(core.services.principals.servicePrincipal, permission.id, function(err) {
                            assert(!err);

                            core.config.cache_provider.get('permissions', fixtures.models.principals.user.id, function(err, permissionObjs) {
                                assert(!err);
                                assert(!permissionObjs);

                                core.services.permissions.permissionsForCached(fixtures.models.principals.user.id, function(err, permissions) {
                                    assert(!err);
                                    assert(permissions.length);

                                    var found = false;
                                    permissions.forEach(function(permission) {
                                        found = found || permission.priority === 50000000
                                    })

                                    assert(!found);

                                    done();
                                });
                            });
                        });
                    });
                }
            );
        });
    });
});