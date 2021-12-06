// @flow
const path = require("path");
const fs = require("fs");

// Make sure any symlinks in the project folder are resolved:
// https://github.com/facebookincubator/create-react-app/issues/637
const appDirectory /*: string */ = fs.realpathSync(process.cwd());
const resolveApp = (relativePath /*: string */) /*: string */ =>
  path.resolve(appDirectory, relativePath);
const pluginFixtureDirectory /*: string */ = (resolveApp(
  "src/plugins/package/fixtures"
) /*: string */);
// config after eject: we're in ./config/
module.exports = {
  root: appDirectory,
  dotenv: (resolveApp(".env") /*: string */),
  favicon: (resolveApp("src/assets/logo/rasterized/logo_32.png") /*: string */),
  appBuild: (resolveApp("build") /*: string */),
  appIndexJs: (resolveApp("src/ui/index.js") /*: string */),
  serverInfoJson: (resolveApp("src/ui/server-info.json") /*: string */),
  appServerSideRenderingIndexJs: (resolveApp("src/ui/server.js") /*: string */),
  appPackageJson: (resolveApp("package.json") /*: string */),
  appSrc: (resolveApp("src") /*: string */),
  yarnLockFile: (resolveApp("yarn.lock") /*: string */),
  appNodeModules: (resolveApp("node_modules") /*: string */),
  apiBaseJs: (resolveApp("src/api/lib/base.js") /*: string */),
  apiNodeJs: (resolveApp("src/api/lib/node.js") /*: string */),
  apiBuild: (resolveApp("dist") /*: string */),
  backendBuild: (resolveApp("bin") /*: string */),

  pluginFixtureDirectory,
  testOutputPaths: {
    packagePlugin: (resolveApp("dist/fixtures/packagePlugin") /*: string */),
  },
  // This object should have one key-value pair per entry point. For
  // each key, the value should be the path to the entry point for the
  // source file, and the key will be the filename of the bundled entry
  // point within the build directory.
  backendEntryPoints: {
    sourcecred: (resolveApp("src/cli/main.js") /*: string */),
    //
    generateGithubGraphqlFlowTypes: (resolveApp(
      "src/plugins/github/bin/generateGraphqlFlowTypes.js"
    ) /*: string */),
    fetchAndPrintGithubRepo: (resolveApp(
      "src/plugins/github/bin/fetchAndPrintGithubRepo.js"
    ) /*: string */),
    fetchAndPrintGithubOrg: (resolveApp(
      "src/plugins/github/bin/fetchAndPrintGithubOrg.js"
    ) /*: string */),
    createExampleRepo: (resolveApp(
      "src/plugins/git/bin/createExampleRepo.js"
    ) /*: string */),
  },
  testEntryPoints: {
    packagePlugin: (resolveApp(
      `${pluginFixtureDirectory}/index.js`
    ) /*: string*/),
    packagePluginJSON: (resolveApp(
      `${pluginFixtureDirectory}/_package.json`
    ) /*: string */),
  },
};
