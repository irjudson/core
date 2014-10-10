var async = require('async')
  , core = require('../../lib')
  , fs = require('fs')
  , moment = require('moment');

var serviceStartTime = new Date();

var filterByType = function(principals, type) {
    var principalsOfType = [];
    principals.forEach(function(principal) {
        if (principal.type === type)
            principalsOfType.push(principal);
    });

    return principalsOfType;
};

// TODO: when scaled out do we just let all the nodes do this and use the
// entropy in the offset timing of that automatically scale these deletes?
var janitor = function(callback) {
    core.services.accessTokens.remove({ expires_at: { $lt: new Date() } }, function(err, removed) {
        if (err) callback("janitor message removal failed: " + err);
        core.log.info("janitor removed " + removed + " expired access tokens.");

        core.services.messages.remove(core.services.principals.servicePrincipal, { index_until: { $lt: new Date() } }, function(err, removed) {
            if (err) callback("janitor message removal failed: " + err);
            core.log.info("janitor removed " + removed + " messages.");

            core.services.subscriptions.janitor(callback);
          });
    });
};

var migrate = function(callback) {
    core.models.Metadata.findOne({ key: 'schemaVersion' }, function(err, schemaVersion) {
        if (err) throw err;

        if (!schemaVersion) {
            schemaVersion = new core.models.Metadata({ key: 'schemaVersion', value: '0' });
            schemaVersion.save();
        }

        core.log.info('current schema version: ' + schemaVersion.value);

        fs.readdir('./migrations', function(err, files) {
            if (err) return callback();

            async.eachSeries(files, function(file, cb) {
                var fileMigrationPosition = parseInt(file);

                if (parseInt(file) > schemaVersion.value) {
                    core.log.info('starting migration: ' + file);

                    require('../../migrations/' + file).up(function(err) {
                        if (err) return cb(err);

                        core.log.info('migration successful, updating current schema version to ' + fileMigrationPosition);
                        core.models.Metadata.update({ _id: schemaVersion.id }, { value: fileMigrationPosition }, cb);
                    });
                } else {
                    return cb();
                }
            }, callback);
        });
    });
};

var startJanitor = function(callback) {
    setInterval(function() {
        janitor(function(err) {
            if (err) core.log.error(err);
        });
    }, core.config.janitor_interval);

    return callback();
};

var uptime = function() {
    return Math.floor((new Date().getTime() - serviceStartTime.getTime()) / 1000.0);
};

module.exports = {
    janitor: janitor,
    migrate: migrate,
    startJanitor: startJanitor,
    uptime: uptime
};