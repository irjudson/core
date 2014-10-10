var core = require('../../lib');

var send = function(email, callback) {
    core.config.email_provider.send(email, callback);
};

module.exports = {
    send: send
};