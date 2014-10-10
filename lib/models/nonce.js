var BaseSchema = require('./baseSchema')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var NONCE_LIFETIME_SECONDS = 5 * 60;

var nonceSchema = new BaseSchema();
nonceSchema.add({
//  From BaseSchema:
//  created_at:     { type: Date, default: Date.now },

    nonce:          { type: String }, // base64
    principal:      { type: Schema.Types.ObjectId, ref: 'Principal' },
});

nonceSchema.index({ nonce: 1 });
nonceSchema.index({ principal: 1 });
nonceSchema.index({ created_at: 1 }, { expireAfterSeconds: NONCE_LIFETIME_SECONDS });

var Nonce = mongoose.model('Nonce', nonceSchema);

module.exports = Nonce;