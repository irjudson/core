var assert = require('assert')
  , core = require('../../lib');

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
});