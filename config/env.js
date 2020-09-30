// @flow
const fs = require("fs");
const stringify = require("json-stable-stringify");
const path = require("path");

const paths = require("./paths");

// Make sure that including paths.js after env.js will read .env variables.
delete require.cache[require.resolve("./paths")];

const NODE_ENV = process.env.NODE_ENV;
if (!NODE_ENV) {
  throw new Error(
    "The NODE_ENV environment variable is required but was not specified."
  );
}

// https://github.com/bkeepers/dotenv#what-other-env-files-can-i-use
var dotenvFiles = [
  `${paths.dotenv}.${NODE_ENV}.local`,
  `${paths.dotenv}.${NODE_ENV}`,
  // Don't include `.env.local` for `test` environment
  // since normally you expect tests to produce the same
  // results for everyone
  ...(NODE_ENV !== "test" ? [`${paths.dotenv}.local`] : []),
  paths.dotenv,
];

// Load environment variables from .env* files. Suppress warnings using silent
// if this file is missing. dotenv will never modify any environment variables
// that have already been set.  Variable expansion is supported in .env files.
// https://github.com/motdotla/dotenv
// https://github.com/motdotla/dotenv-expand
dotenvFiles.forEach((dotenvFile) => {
  if (fs.existsSync(dotenvFile)) {
    require("dotenv-expand")(
      require("dotenv").config({
        path: dotenvFile,
      })
    );
  }
});

// We support resolving modules according to `NODE_PATH`.
// This lets you use absolute paths in imports inside large monorepos:
// https://github.com/facebookincubator/create-react-app/issues/253.
// It works similar to `NODE_PATH` in Node itself:
// https://nodejs.org/api/modules.html#modules_loading_from_the_global_folders
// Note that unlike in Node, only *relative* paths from `NODE_PATH` are honored.
// Otherwise, we risk importing Node.js core modules into an app instead of Webpack shims.
// https://github.com/facebookincubator/create-react-app/issues/1023#issuecomment-265344421
// We also resolve them to make sure all tools using them work consistently.
const appDirectory = fs.realpathSync(process.cwd());
process.env.NODE_PATH = (process.env.NODE_PATH || "")
  .split(path.delimiter)
  .filter((folder) => folder && !path.isAbsolute(folder))
  .map((folder) => path.resolve(appDirectory, folder))
  .join(path.delimiter);

/*::
type Env = {|
  // Environment like `process.env`: e.g., `raw["NODE_ENV"] === "development"`.
  +raw: {|+[string]: string|},
  // Environment whose values are stringified for transclusion into JS
  // source code: e.g.,
  //
  //     stringified["process.env"]["NODE_ENV"] === '"development"'
  //
  // (note extra quotes).
  +stringified: {|+"process.env": {|+[string]: string|}|},
  // Like `stringified`, but the keys are `process.env.*` expressions:
  //
  //     individuallyStringified["process.env.NODE_ENV"] === '"development"'
  +individuallyStringified: {|+[string]: string|},
|};
 */

// TODO: When we have switched fully to the instance system, we can remove
// the projectIds argument.
function getClientEnvironment(
  projectIds /*: $ReadOnlyArray<string> | null */
) /*: Env */ {
  const raw = {};
  // Useful for determining whether we’re running in production mode.
  // Most importantly, it switches React into the correct mode.
  raw.NODE_ENV = process.env.NODE_ENV || "development";
  // Optional. Used by `src/homepage/routeData.js`
  raw.PROJECT_IDS = stringify(projectIds);

  // Stringify all values so we can feed into Webpack's DefinePlugin.
  const stringified = {"process.env": {}};
  const individuallyStringified = {};
  for (const key of Object.keys(raw)) {
    const value = JSON.stringify(raw[key]);
    stringified["process.env"][key] = value;
    individuallyStringified["process.env." + key] = value;
  }

  return {raw, stringified, individuallyStringified};
}

module.exports = getClientEnvironment;
