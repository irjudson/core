var mongoose = require('mongoose'),
	util = require('util');

var BaseSchema = function() {
  mongoose.Schema.call(this);

  // base fields used by all models
  this.add({ created_at: { type: Date, default: Date.now } });
  this.add({ updated_at: { type: Date, default: Date.now } });
};

util.inherits(BaseSchema, mongoose.Schema);

BaseSchema.baseObjectTransform = function(doc, ret, options) {
    ret.id = ret._id;
    delete ret.__v;
};

BaseSchema.baseJsonTransform = function(doc, ret, options) {
    BaseSchema.baseObjectTransform(doc, ret, options);

    delete ret._id;
};

module.exports = BaseSchema;