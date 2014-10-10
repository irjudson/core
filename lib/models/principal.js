var BaseSchema = require('./baseSchema')
  ,	mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var principalSchema = new BaseSchema();
principalSchema.add({
//  From BaseSchema:
//  created_at:      { type: Date, default: Date.now },

    type:            { type: String },
    name:            { type: String },

    claim_code:      { type: String },

    last_ip:         { type: String },
    last_connection: { type: Date, default: Date.now },

    tags:            [{ type: String }],

// for users, this is their api_key. for others, this is the api_key that authorized their creation.

    api_key:         { type: Schema.Types.ObjectId, ref: 'ApiKey' },

// non-user fields

    // non-users auth can auth via either a secret (less secure, lower computation requirements) or
    // public_key (more secure, higher computational requirements).

    public_key:      { type: String }, // base64
    secret_hash:     { type: String }, // base64

// device fields

    sensors: [{
        id:         Number,
        name:       String,
        executes:   [{ type: String }],
        sends:      [{ type: String }]
    }],

// service fields (which needs to retain these for itself so it can auth)

    private_key:     { type: String },
    secret:          { type: String },

// user fields

    email:           { type: String },
    password_hash:   { type: String }, // base64
    salt:            { type: String }, // base64

// internally used fields

    visible_to:      [{ type: Schema.Types.ObjectId, ref: 'Principal' }]
});

principalSchema.index({ claim_code: 1 });
principalSchema.index({ created_at: 1 });
principalSchema.index({ email: 1 });
principalSchema.index({ last_ip: 1 });
principalSchema.index({ last_connection: 1 });
principalSchema.index({ tags: 1 });
principalSchema.index({ type: 1 });
principalSchema.index({ updated_at: 1 });
principalSchema.index({ visible_to: 1 });

principalSchema.virtual('password').set(function(value) { this._password = value; });
principalSchema.virtual('password').get(function() { return this._password; });

var principalJsonTransform = function(doc, ret, options) {
    BaseSchema.baseJsonTransform(doc, ret, options);

    delete ret.salt;
    delete ret.password_hash;
    delete ret.private_key;
    delete ret.secret_hash;
    delete ret.secret;
    delete ret.visible_to;
};

principalSchema.set('toObject', { transform: BaseSchema.baseObjectTransform  });
principalSchema.set('toJSON', { transform: principalJsonTransform });

principalSchema.path('type').validate(function (value) {
    return Principal.PRINCIPAL_TYPES.indexOf(value) !== -1;
}, 'Principal must have valid type.');

var Principal = mongoose.model('Principal', principalSchema);

Principal.prototype.is = function(type) {
    return this.type === type;
};

Principal.prototype.equals = function(principal) {
    return principal.id.equals(this.id);
};

Principal.PRINCIPAL_TYPES = ['app', 'device', 'reactor', 'service', 'user'];

module.exports = Principal;
