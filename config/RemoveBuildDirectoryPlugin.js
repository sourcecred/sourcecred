// @flow

const fs = require("fs-extra");
const path = require("path");

// Note: the following type-import just resolves to `any`.
/*:: import type {Compiler} from "webpack"; */

module.exports = class RemoveBuildDirectoryPlugin {
  apply(compiler /*: Compiler */) {
    if (compiler.hooks) {
      console.warn(
        "" +
          "You appear to be running Webpack >= 4. " +
          "The RemoveBuildDirectoryPlugin should be forward-compatible, " +
          "but you should update it to use the new APIs. See " +
          "<https://github.com/webpack/webpack/releases/tag/v4.0.0-beta.0> " +
          "for details."
      );
    }
    compiler.plugin("compile", () => {
      const outputPath = compiler.options.output.path;
      // If a build config has no `output.path` property, and no
      // `--output-path` is passed on the command line, then Webpack
      // will default to building into the current directory. Removing
      // the whole Git repository would be mighty rude, so we protect
      // against that case.
      if (fs.existsSync(path.join(outputPath, ".git"))) {
        throw new Error(
          "Refusing to remove build directory with a Git repository: " +
            outputPath
        );
      }
      console.warn("Removing contents of build directory: " + outputPath);
      fs.emptyDirSync(outputPath);
    });
  }
};
