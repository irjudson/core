var assert = require('assert')
  , core = require('../../lib');

describe('apiKeys service', function() {
    it('can create, check, and remove apiKeys', function(done) {
        var apiKey = new core.models.ApiKey({
            owner: core.fixtures.models.principals.anotherUser,
            name: 'my app',
            type: 'app',
            redirect_uri: "http://localhost:9000/"
        });

        core.services.apiKeys.create(core.services.principals.servicePrincipal, apiKey, function(err, apiKey) {
            assert(!err);

            assert(apiKey.key);
            assert.notEqual(apiKey.key.length, 0);

            assert(apiKey.id);

            core.services.apiKeys.check(apiKey.key, apiKey.redirect_uri + "/suffix", function(err, checkApiKey) {
                assert(!err);

                assert(checkApiKey);
                assert(checkApiKey.id === apiKey.id);

                core.services.apiKeys.check(apiKey.key, "http://roguesite.com", function(err, checkApiKey) {
                    assert(err);
                    assert(!checkApiKey);

                    core.services.apiKeys.remove({ _id: apiKey.id }, function(err, removed) {
                        assert(!err);
                        assert.equal(removed, 1);
                        done();
                    });
                });
            });
        });
    });
});