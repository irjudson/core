var BaseSchema = require('./baseSchema'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var subscriptionSchema = new BaseSchema();
subscriptionSchema.add({
//  From BaseSchema:
//  created_at:     { type: Date, default: Date.now },

    assignment:     { type: String },                   // used by provider to determine the backend used for this subscription.
    filter_string:  { type: String },                 // can't have Mixed because of $ operators, use virtual below to proxy this.
    last_receive:   { type: Date, default: Date.now },
    name:           { type: String },
    permanent:      { type: Boolean },
    principal:      { type: Schema.Types.ObjectId, ref: 'Principal' },
    type:           { type: String }
});

subscriptionSchema.index({ last_receive: 1 });
subscriptionSchema.index({ principal: 1 });
subscriptionSchema.index({ name: 1 });

subscriptionSchema.set('toObject', { transform: BaseSchema.baseObjectTransform });
subscriptionSchema.set('toJSON', { transform: BaseSchema.baseJsonTransform });

subscriptionSchema.virtual('clientId').set(function(value) { this._clientId = value; });
subscriptionSchema.virtual('clientId').get(function() { return this._clientId; });

subscriptionSchema.virtual('filter').set(function(value) { this.filter_string = JSON.stringify(value); });
subscriptionSchema.virtual('filter').get(function() { return JSON.parse(this.filter_string); });

subscriptionSchema.virtual('socket').set(function(value) { this._socket = value; });
subscriptionSchema.virtual('socket').get(function() { return this._socket; });

var Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;