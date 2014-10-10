var assert = require('assert')
  , core = require('../../lib');

describe('global service', function() {
    it('can run migrations', function(done) {
        core.services.global.migrate(function(err) {
            assert.ifError(err);
            done();
        });
    });

    it('can run janitor iteration', function(done) {
        core.services.global.janitor(function(err) {
            assert.ifError(err);
            done();
        });
    });
});