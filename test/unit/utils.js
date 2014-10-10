var assert = require('assert')
  , core = require('../../lib');

describe('utils', function() {

    it('can translate sensed date strings into date objects', function(done) {
        var testObject = {
            shouldBeString: "test",
            shouldBeDate: "2013-05-06T18:27:33.053Z"
        };

        var translatedObject = core.utils.translateQuery(testObject, { dateFields: ['shouldBeDate'] });

        assert.equal(typeof translatedObject.shouldBeString, "string");
        assert.equal(typeof translatedObject.shouldBeDate, "object");

        var testObjectWithHierarchy = {
            hasADate: {
                justAString: "test",
                shouldBeDate: "2013-05-06T18:27:33.053Z"
            }
        };

        var hierarchyObject = core.utils.translateQuery(testObjectWithHierarchy, { dateFields: ['shouldBeDate'] });

        assert.equal(typeof hierarchyObject.hasADate.justAString, "string");
        assert.equal(typeof hierarchyObject.hasADate.shouldBeDate, "object");

        done();
    });

});
