// @flow
const path = require("path");
const fs = require("fs");

// Make sure any symlinks in the project folder are resolved:
// https://github.com/facebookincubator/create-react-app/issues/637
const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = (relativePath) => path.resolve(appDirectory, relativePath);

// config after eject: we're in ./config/
module.exports = {
  root: appDirectory,
  dotenv: resolveApp(".env"),
  favicon: resolveApp("src/assets/logo/sourcecred_32.png"),
  appBuild: resolveApp("build"),
  appIndexJs: resolveApp("src/app/index.js"),
  appServerSideRenderingIndexJs: resolveApp("src/app/server.js"),
  appRouteData: resolveApp("src/app/routeData.js"),
  appPackageJson: resolveApp("package.json"),
  appSrc: resolveApp("src"),
  yarnLockFile: resolveApp("yarn.lock"),
  appNodeModules: resolveApp("node_modules"),

  backendBuild: resolveApp("bin"),
  // This object should have one key-value pair per entry point. For
  // each key, the value should be the path to the entry point for the
  // source file, and the key will be the filename of the bundled entry
  // point within the build directory.
  backendEntryPoints: {
    sourcecred: resolveApp("src/oclif/sourcecred.js"),
    "commands/load": resolveApp("src/oclif/commands/load.js"),
    cli: resolveApp("src/cli/main.js"),
    //
    fetchAndPrintGithubRepo: resolveApp(
      "src/plugins/github/bin/fetchAndPrintGithubRepo.js"
    ),
    createExampleRepo: resolveApp("src/plugins/git/bin/createExampleRepo.js"),
    loadAndPrintGitRepository: resolveApp(
      "src/plugins/git/bin/loadAndPrintRepository.js"
    ),
  },
};
