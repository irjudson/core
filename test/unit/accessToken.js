var assert = require('assert')
  , moment = require('moment')
  , core = require('../../lib')
  , jwt = require('jsonwebtoken');

describe('accessToken service', function() {
    it('can create and remove tokens', function(done) {
        core.services.accessTokens.create(core.fixtures.models.principals.anotherUser, function(err, accessToken) {
            assert(!err);

            core.services.accessTokens.findByTokenCached(accessToken.token, function(err, accessToken) {
                assert(!err);
                assert(accessToken);

                core.config.cache_provider.get('accessTokens', "token." + accessToken.token, function(err, accessTokenObj) {
                    assert(!err);
                    assert(accessTokenObj);

                    core.services.accessTokens.remove({ _id: accessToken.id }, function(err, removed) {
                        assert(!err);
                        assert.equal(removed, 1);

                        core.config.cache_provider.get('accessTokens', "token." + accessToken.token, function(err, accessTokenObj) {
                            assert(!err);
                            assert(!accessTokenObj);
                            done();
                        });
                    });
                });
            });
        });
    });

    it('can create a token with the correct default expiration (1 day)', function(done) {
        core.services.accessTokens.create(core.fixtures.models.principals.anotherUser, function(err, accessToken) {
            assert(!err);
            var expires = moment(accessToken.expiration);
            var oneDayFromNow = moment().add(1, 'days');
            assert((oneDayFromNow - expires) == (60 * 60 * 24 * 1000));

            // test to make sure token is valid.
            jwt.verify(accessToken.token, core.config.access_token_signing_key, function(err, jwtToken) {
                assert(!err);

                done();
            });
        });
    });

    it('can create a token with a custom expiration', function(done) {
        core.services.accessTokens.create(core.fixtures.models.principals.anotherUser, { expires: moment().add(30, 'days') }, function(err, accessToken) {
            assert(!err);
            var expires = moment(accessToken.expiration);
            var thirtyDaysFromNow = moment().add(30, 'days');
            assert((thirtyDaysFromNow - expires) == (30 * 60 * 60 * 24 * 1000));
            done();
        });
    });
});