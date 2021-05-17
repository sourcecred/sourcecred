// @flow

const fs = require("fs-extra");
const path = require("path");

/*:: type Compiler = any; */

const pluginName = "RemoveBuildDirectoryPlugin";
class RemoveBuildDirectoryPlugin {
  apply(compiler /*: Compiler */) {
    compiler.hooks.run.tap(pluginName, () => {
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
}

module.exports = RemoveBuildDirectoryPlugin;
