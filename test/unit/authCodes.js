var assert = require('assert')
  , core = require('../../lib')
  , fixtures = require('../fixtures');

describe('authCodes service', function() {
    it('can create, check, and remove authCodes', function(done) {
        var authCode = new core.models.AuthCode({
            user: fixtures.models.principals.anotherUser.id,
            redirect_uri: "http://localhost:9000/"
        });

        core.services.authCodes.create(authCode, function(err, authCode) {
            assert(!err);

            assert(authCode.code);
            assert.notEqual(authCode.code.length, 0);

            assert(authCode.id);

            core.services.authCodes.check(authCode.code, fixtures.models.principals.anotherUser, function(err, checkAuthCode) {
                assert(!err);

                assert(checkAuthCode);
                assert(checkAuthCode.id === authCode.id);

                core.services.authCodes.check(authCode.code, fixtures.models.principals.user, function(err, checkAuthCode) {
                    assert(err);
                    assert(!checkAuthCode);

                    core.services.authCodes.remove({ code: authCode.code }, function(err, removed) {
                        assert(!err);
                        assert.equal(removed, 1);
                        done();
                    });
                });
            });
        });
    });
});