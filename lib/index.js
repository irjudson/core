// config and log should be injected by the host

var config;
var log;

exports.config         = config;
exports.log            = log;

exports.models         = require('./models');
exports.services       = require('./services');
exports.utils          = require('./utils');
exports.fixtures       = require('./fixtures')