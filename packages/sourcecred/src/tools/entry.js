// @flow
//
// Common entry point module. This module should be required by every
// module that is intended to be run as a standalone application.

const util = require("util");

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", (err) => {
  const details = util.inspect(err, {showHidden: true, depth: null});
  console.error(details);
  throw err;
});
