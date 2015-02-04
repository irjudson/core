var async = require('async')
  , core = require('../../lib')
  , mongoose = require('mongoose');

var canView = function(principal, blob, callback) {
    core.services.permissions.authorize({
        principal: principal.id,
        principal_for: blob.owner,
        action: 'view'
    }, blob, function(err, permission) {
        if (err) return callback(err);
        if (!permission.authorized) {
            core.log.warn('principal: ' + principal.id + ' attempted unauthorized view of blob: ' + blob.id + ' with owner: ' + blob.owner);
            return callback(core.utils.authorizationError(permission));
        }

        return callback(null);
    });
};

var create = function(principal, blob, stream, callback) {
    if (!core.config.blob_provider) return callback(core.utils.internalError('No blob provider configured.'));

    // TODO: authorization of principal to create blob here.

    core.config.blob_provider.create(blob, stream, function(err, blob) {
        if (err) return callback(err);

        blob.owner = principal;
        blob.id = new mongoose.Types.ObjectId();
        blob.link = new mongoose.Types.ObjectId();
        blob.url = core.config.blobs_endpoint + '/' + blob.id;

        blob.save(function(err, blob) {
            if (err) return callback(err);

            core.log.debug('created blob with id: ' + blob.id);
            callback(null, blob);
        });
    });
};

var findById = function(blobId, callback) {
    core.models.Blob.findOne({"_id": blobId}, callback);
};

var initialize = function(callback) {
    if (!core.config.blob_provider) return callback();

    core.config.blob_provider.initialize(callback);
};

var remove = function(principal, query, callback) {
    if (!principal || !principal.is('service')) {
        return callback(core.utils.authorizationError());
    }

    core.models.Blob.find(query, function (err, blobs) {

        async.eachLimit(blobs, 50, function(blob, cb) {
            core.config.blob_provider.remove(blob, cb);
        }, function(err) {
            if (err) return callback(err);

            core.models.Blob.remove(query, callback);
        });
    });
};

var stream = function(principal, blobId, stream, callback) {
    findById(blobId, function(err, blob) {
        if (err) return callback(err);
        if (!blob) return callback(core.utils.notFoundError());

        canView(principal, blob, function(err) {
            if (err) return callback(err);

            core.config.blob_provider.stream(blob, stream, callback);
        });
    });
};

module.exports = {
    create: create,
    findById: findById,
    initialize: initialize,
    remove: remove,
    stream: stream
};
