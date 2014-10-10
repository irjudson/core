var BaseSchema = require('./baseSchema'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var accessTokenSchema = new BaseSchema();
accessTokenSchema.add({
//  From BaseSchema:
//  created_at:     { type: Date, default: Date.now },

    expires_at:     { type: Date },
    principal:      { type: Schema.Types.ObjectId, ref: 'Principal' },
    token:          { type: String }
});

accessTokenSchema.index({ principal: 1 });
accessTokenSchema.index({ expires_at: 1 });
accessTokenSchema.index({ token: 1 });

accessTokenSchema.set('toObject', { transform: BaseSchema.baseObjectTransform });
accessTokenSchema.set('toJSON', { transform: BaseSchema.baseJsonTransform });

var AccessToken = mongoose.model('AccessToken', accessTokenSchema);

AccessToken.prototype.expired = function() {
    return this.secondsToExpiration() <= 0;
};

AccessToken.prototype.secondsToExpiration = function() {
    return (this.expires_at.getTime() - Date.now()) / 1000.0;
};

AccessToken.prototype.toAuthHeader = function() {
    return "Bearer " + this.token;
};

module.exports = AccessToken;