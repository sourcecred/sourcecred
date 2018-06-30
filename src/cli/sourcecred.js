// @flow
require("../tools/entry");
require("@oclif/command")
  .run()
  .catch(require("@oclif/errors/handle"));
