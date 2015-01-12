var BaseSchema = require('./baseSchema')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var messageSchema = new BaseSchema();
messageSchema.add({
//  From BaseSchema:
//  created_at:     { type: Date, default: Date.now },

    type:           { type: String },                                  // schema type
    ver:            { type: Number, default: 0.2 },                    // schema version

    link:           { type: Schema.Types.ObjectId },                   // link to other resources (eg. blob)
    expires:        { type: Date },                                    // when content in message becomes invalid
    index_until:    { type: Date },                                    // date after which this message will be only available in the archive
    ts:             { type: Date, default: Date.now },                 // timestamp

    from:           { type: Schema.Types.ObjectId, ref: 'Principal' }, // principal who sent message
    to:             { type: Schema.Types.ObjectId, ref: 'Principal' }, // principal message is to (optional)
    response_to:    [{ type: Schema.Types.ObjectId, ref: 'Message' }], // message(s) this is in response to

    sensor_id:      { type: Number },                                  // sensor or acuator this message belongs to

    tags:           [{ type: String }],
    body:           { type: Schema.Types.Mixed, default: {} },

    // internal fields

    visible_to:     [{ type: Schema.Types.ObjectId, ref: 'Principal' }],
    body_length:    { type: Number }
});

var MESSAGE_INDEXES = [
    { created_at: 1 },
    { expires: 1 },
    { from: 1 },
    { index_until: 1 },
    { sensor_id: 1 },
    { tags: 1 },
    { type: 1 },
    { to: 1 },
    { ts: -1 },
    { visible_to: 1}
];

MESSAGE_INDEXES.forEach(function(index) {
    messageSchema.index(index);
});

// add fake indexes that cover id queries (since these are indexed by default).
// this enables queries on these to succeed since they have a covering index.

MESSAGE_INDEXES = MESSAGE_INDEXES.concat([
    { id: 1 },
    { _id: 1 }
]);

var messageJsonTransform = function(doc, ret, options) {
    BaseSchema.baseJsonTransform(doc, ret, options);

    delete ret.body_length;
    delete ret.visible_to;
};

messageSchema.set('toObject', { transform: BaseSchema.baseObjectTransform });
messageSchema.set('toJSON', { transform: messageJsonTransform });

var Message = mongoose.model('Message', messageSchema);

Message.filterHasIndex = function(filter) {
    var filterIdx;
    var filterKeys = Object.keys(filter);

    if (filterKeys.length === 0)
        return true;

    for (filterIdx = 0; filterIdx < filterKeys.length; filterIdx++) {
        var filterKey = filterKeys[filterIdx];

        var indexesIdx;
        for (indexesIdx = 0; indexesIdx < MESSAGE_INDEXES.length; indexesIdx++) {
            var firstIndexKey = Object.keys(MESSAGE_INDEXES[indexesIdx])[0];

            if (firstIndexKey === filterKey)
                return true;
        }
    }

    return false;
};

Message.fieldTranslationSpec = {
    dateFields: ['created_at', 'expires', 'index_until', 'ts'],
    objectIdFields: ['from', 'to', 'link', 'response_to']
};

Message.prototype.expired = function() {
    return Date.now() > this.expires.getTime();
};

Message.prototype.isCustomType = function() {
    return this.type[0] === "_";
};

Message.prototype.is = function(type) {
    return this.type === type;
};

Message.NEVER_EXPIRE  = new Date(Date.UTC(2500, 0, 1));
Message.INDEX_FOREVER = new Date(Date.UTC(2500, 0, 1));

module.exports = Message;
