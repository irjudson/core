var assert = require('assert')
  , async = require('async')
  , config = require('./config')
  , fixtures = require('./fixtures')
  , log = require('winston')
  , core = require('../lib')
  , mongoose = require('mongoose');

core.config = config;
core.log = log;

var removeAll = function (modelType, callback) {
    modelType.remove({}, callback);
};

before(function(done) {
    mongoose.connect(config.mongodb_connection_string);
    mongoose.connection.once('open', function () {
        log.debug('mongo connected');

        var modelTypes = Object.keys(core.models).map(function(key) { return core.models[key]; });

        async.each(modelTypes, removeAll, function(err) {
            assert(!err);
            log.debug('cleared modules');

            core.services.initialize(function(err) {
                assert(!err);
                log.debug('services initialized');

                config.pubsub_provider.resetForTest(function(err) {
                    assert(!err);
                    log.debug('pubsub reset');

                    fixtures.reset(function(err) {
                        assert(!err);
                        log.debug('fixtures put in place');

                        done();
                    });
                });
            });
        });
    });
});
