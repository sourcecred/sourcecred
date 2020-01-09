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
  favicon: resolveApp("src/assets/logo/rasterized/logo_32.png"),
  appBuild: resolveApp("build"),
  appIndexJs: resolveApp("src/homepage/index.js"),
  appServerSideRenderingIndexJs: resolveApp("src/homepage/server.js"),
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
    sourcecred: resolveApp("src/cli/main.js"),
    api: resolveApp("src/api/index.js"),
    //
    generateGithubGraphqlFlowTypes: resolveApp(
      "src/plugins/github/bin/generateGraphqlFlowTypes.js"
    ),
    fetchAndPrintGithubRepo: resolveApp(
      "src/plugins/github/bin/fetchAndPrintGithubRepo.js"
    ),
    fetchAndPrintGithubOrg: resolveApp(
      "src/plugins/github/bin/fetchAndPrintGithubOrg.js"
    ),
    createExampleRepo: resolveApp("src/plugins/git/bin/createExampleRepo.js"),
  },
};
