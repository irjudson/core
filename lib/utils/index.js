var fs = require('fs')
  , core = require('../../lib')
  , mongoose = require('mongoose')
  , ServiceError = require('./serviceError');

var authenticationError = function(msg) {
    return new ServiceError({
        statusCode: 401,
        message: msg || "Authentication failed, please log in."
    });
};

var authorizationError = function(msg) {
    var msg = msg || "Principal is not authorized to perform the requested operation.";

    return new ServiceError({
        statusCode: 403,
        message: msg
    });
};

var badRequestError = function(msg) {
    return new ServiceError({
        statusCode: 400,
        message: msg
    });
};

var handleError = function(res, err) {
    if (err instanceof ServiceError) {
        var statusCode = err.statusCode || 400;
        core.log.error(err.message);

        return sendFailedResponse(res, statusCode, err);
    }

    if (err === 400) return sendFailedResponse(res, 400, err);
    if (err === 401) return sendFailedResponse(res, 401, err);
    if (err === 403) return sendFailedResponse(res, 403, err);
    if (err === 404) return sendFailedResponse(res, 404, err);
    if (err) return sendFailedResponse(res, 400, err);
};

var internalError = function(msg) {
    return new ServiceError({
        statusCode: 500,
        message: msg
    });
};

var ipFromRequest = function(req) {
    if (!req || !req.ip) return;

    var ipParts = req.ip.split(":");
    if (ipParts.length)
        return ipParts[0];
    else
        return req.ip;
};

var nop = function() {
    var callback;
    if (arguments) {
        callback = arguments[arguments.length-1];
    }

    if (callback) return callback();
}

var notFoundError = function(msg) {
    return new ServiceError({
        statusCode: 404,
        message: msg || "Requested resource not found."
    });
};

var parseQuery = function(req) {
    var query = {};
    if (req.query.q) {
        query = JSON.parse(req.query.q);
    }

    return query;
};

var parseOptions = function(req) {
    var options = {};

    if (req.query.options) {
        options = JSON.parse(req.query.options);
    }

    if (!options.limit || options.limit > 10000) options.limit = 10000;

    return options;
};

var pipeFile = function(filename) {
    return function(req, res) {
        fs.exists(filename, function(exists) {
            if (!exists) return core.log.error('pipeFile: path ' + filename + ' not found.');

            fs.createReadStream(filename).pipe(res);
        });
    };
};

var principalRequired = function() {
    return new ServiceError({
        statusCode: 400,
        message: "Principal required to perform the requested operation."
    });
};

var sendFailedResponse = function(res, statusCode, err) {
    res.contentType('application/json');
    res.send(statusCode, { error: err });
};

var stringEndsWith = function(s, suffix) {
    return s.indexOf(suffix, s.length - suffix.length) !== -1;
};

var stringStartsWith = function(s, prefix) {
    return s.substr(0, prefix.length) === prefix;
};

// convert dates to Date objects and string objectIds to objectIds
var translateQuery = function(obj, options) {
    for (var prop in obj) {
        if (typeof obj[prop] === "object")

            // recursively handle subobjects
            obj[prop] = translateQuery(obj[prop], options);

        else if (options.objectIdFields && options.objectIdFields.indexOf(prop) != -1) {

            if (Object.prototype.toString.call(obj[prop]) === '[object Array]') {
                obj[prop] = obj[prop].map(mongoose.Types.ObjectId);
            } else {
                obj[prop] = new mongoose.Types.ObjectId(obj[prop]);
            }

        } else if (options.dateFields && options.dateFields.indexOf(prop) != -1) {

            obj[prop] = new Date(Date.parse(obj[prop]));

        }
    }

    return obj;
};

var uuid = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
};

module.exports = {
    authenticationError: authenticationError,
    authorizationError: authorizationError,
    badRequestError: badRequestError,
    ipFromRequest: ipFromRequest,
    internalError: internalError,
    handleError: handleError,
    nop: nop,
    notFoundError: notFoundError,
    parseQuery: parseQuery,
    parseOptions: parseOptions,
    pipeFile: pipeFile,
    principalRequired: principalRequired,
    sendFailedResponse: sendFailedResponse,
    ServiceError: ServiceError,
    stringEndsWith: stringEndsWith,
    stringStartsWith: stringStartsWith,
    translateQuery: translateQuery,
    uuid: uuid
};
