// @flow
const path = require("path");
const fs = require("fs");

// Make sure any symlinks in the project folder are resolved:
// https://github.com/facebookincubator/create-react-app/issues/637
const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = (relativePath) => path.resolve(appDirectory, relativePath);

const envPublicUrl = process.env.PUBLIC_URL;

function ensureSlash(path /*: string */, needsSlash /*: bool */) {
  const hasSlash = path.endsWith("/");
  if (hasSlash && !needsSlash) {
    return path.substr(0, path.length - 1);
  } else if (!hasSlash && needsSlash) {
    return `${path}/`;
  } else {
    return path;
  }
}

const getPublicUrl = () => envPublicUrl || "/";

// We use `PUBLIC_URL` environment variable field to infer "public path" at
// which the app is served. Defaults to "/"
// Webpack needs to know it to put the right <script> hrefs into HTML even in
// single-page apps that may serve index.html for nested URLs like /todos/42.
// We can't use a relative path in HTML because we don't want to load something
// like /todos/42/static/js/bundle.7289d.js. We have to know the root.
function getServedPath() {
  return ensureSlash(getPublicUrl(), true);
}

// config after eject: we're in ./config/
module.exports = {
  dotenv: resolveApp(".env"),
  appBuild: resolveApp("build"),
  appPublic: resolveApp("src/bridge/app/public"),
  appHtml: resolveApp("src/bridge/app/public/index.html"),
  appIndexJs: resolveApp("src/bridge/app/index.js"),
  appPackageJson: resolveApp("package.json"),
  appSrc: resolveApp("src"),
  yarnLockFile: resolveApp("yarn.lock"),
  testsSetup: resolveApp("src/v1/setupTests.js"),
  appNodeModules: resolveApp("node_modules"),
  publicUrl: getPublicUrl(),
  servedPath: getServedPath(),

  backendBuild: resolveApp("bin"),
  // This object should have one key-value pair per entry point. For
  // each key, the value should be the path to the entry point for the
  // source file, and the key will be the filename of the bundled entry
  // point within the build directory.
  backendEntryPoints: {
    apiApp: resolveApp("src/bridge/app/apiApp.js"),
    //
    sourcecred: resolveApp("src/v3/cli/sourcecred.js"),
    "commands/load": resolveApp("src/v3/cli/commands/load.js"),
    "commands/start-v3": resolveApp("src/v3/cli/commands/start.js"),
    //
    fetchAndPrintGithubRepoV3: resolveApp(
      "src/v3/plugins/github/bin/fetchAndPrintGithubRepo.js"
    ),
    createExampleRepoV3: resolveApp(
      "src/v3/plugins/git/bin/createExampleRepo.js"
    ),
    loadAndPrintGitRepositoryV3: resolveApp(
      "src/v3/plugins/git/bin/loadAndPrintRepository.js"
    ),
  },
};
