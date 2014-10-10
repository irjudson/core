var BaseSchema = require('./baseSchema')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema;


var AUTH_CODE_LIFETIME_SECONDS = 60 * 60; // seconds (default: 1 hour)

var authCodeSchema = new BaseSchema();
authCodeSchema.add({
//  From BaseSchema:
//  created_at:     { type: Date, default: Date.now },

    code:           { type: String },
    api_key:        { type: Schema.Types.ObjectId, ref: 'ApiKey' },
    app:            { type: Schema.Types.ObjectId, ref: 'Principal' },
    name:           { type: String },
    scope:          { type: String }, // stringified version of the scope
    user:           { type: Schema.Types.ObjectId, ref: 'Principal' },
    redirect_uri:   { type: String }
});

authCodeSchema.index({ code: 1 });
authCodeSchema.index({ created_at: 1 }, { expireAfterSeconds: AUTH_CODE_LIFETIME_SECONDS });

var AuthCode = mongoose.model('AuthCode', authCodeSchema);

module.exports = AuthCode;