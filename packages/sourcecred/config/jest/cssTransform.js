// @flow
// This is a custom Jest transformer turning style imports into empty objects.
// http://facebook.github.io/jest/docs/en/webpack.html

module.exports = {
  process() /*: string */ {
    return "module.exports = {};";
  },
  getCacheKey() /*: string */ {
    // The output is always the same.
    return "cssTransform";
  },
};
