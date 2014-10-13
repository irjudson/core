var assert = require('assert')
  , core = require('../../lib');


    describe('blob service', function() {
        if (core.config.blob_provider) {
            it('can remove a blob', function(done) {
                core.services.blobs.remove(core.services.principals.servicePrincipal,
                    { _id: core.fixtures.models.blobs.removableBlob.id }, function(err, removed) {
                    assert.ifError(err);
                    assert.equal(removed, 1);
                    done();
                });
            });
        }
    });

