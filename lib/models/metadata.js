var BaseSchema = require('./baseSchema')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var metadataSchema = new BaseSchema();
metadataSchema.add({
//  From BaseSchema:
//  created_at:     { type: Date, default: Date.now },

    key:            { type: String },
    value:          { type: String }
});

metadataSchema.index({ key: 1 });

var Metadata = mongoose.model('Metadata', metadataSchema);

module.exports = Metadata;