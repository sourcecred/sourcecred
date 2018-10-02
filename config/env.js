// @flow
const {spawnSync, execFileSync} = require("child_process");
const fs = require("fs");
const stringify = require("json-stable-stringify");
const path = require("path");

const paths = require("./paths");

/*:: import type {GitState} from "../src/app/version"; */

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

// Get the state of the SourceCred Git repository. This requires that
// Git be installed. If this fails for you, please install Git.
//
// If the dependency on Git becomes a problem, we can consider making
// this optional. However, note that this computation is performed at
// build time, so end users of SourceCred as a library or application
// should not need this dependency.
function getGitState() /*: GitState */ {
  const env = {
    GIT_ATTR_NOSYSTEM: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    LANG: "C",
    LC_ALL: "C",
    PATH: process.env.PATH,
    TZ: "UTC",
  };

  const diffIndex = spawnSync(
    "git",
    ["-C", __dirname, "diff-index", "--quiet", "HEAD", "--"],
    {env}
  );
  const dirty = diffIndex.status !== 0;
  if (diffIndex.status !== 0 && diffIndex.status !== 1) {
    throw new Error(diffIndex.status + ": " + diffIndex.stderr.toString());
  }

  const commitHash = execFileSync(
    "git",
    ["-C", __dirname, "rev-parse", "--short=12", "--verify", "HEAD"],
    {env}
  )
    .toString()
    .trim();

  const iso8601Timestamp = execFileSync(
    "git",
    [
      "-C",
      __dirname,
      "show",
      "--no-patch",
      "--format=%cd",
      "--date=iso8601",
      commitHash,
    ],
    {env}
  )
    .toString()
    .trim();
  const commitDate = new Date(iso8601Timestamp);
  function zeroPad(number /*: number */, length /*: number */) /*: string */ {
    return String(number).padStart(length, "0");
  }
  const commitTimestamp = [
    zeroPad(commitDate.getFullYear(), 4),
    zeroPad(commitDate.getMonth(), 2),
    zeroPad(commitDate.getDay(), 2),
    "-",
    zeroPad(commitDate.getHours(), 2),
    zeroPad(commitDate.getMinutes(), 2),
  ].join("");

  return {commitHash, commitTimestamp, dirty};
}

const SOURCECRED_GIT_STATE = stringify(getGitState());
process.env.SOURCECRED_GIT_STATE = SOURCECRED_GIT_STATE;

const SOURCECRED_FEEDBACK_URL =
  process.env.SOURCECRED_FEEDBACK_URL != null
    ? process.env.SOURCECRED_FEEDBACK_URL
    : "https://discuss.sourcecred.io/c/cred-feedback/";
process.env.SOURCECRED_FEEDBACK_URL = SOURCECRED_FEEDBACK_URL;

function getClientEnvironment() {
  const raw = {};
  // Useful for determining whether we’re running in production mode.
  // Most importantly, it switches React into the correct mode.
  raw.NODE_ENV = process.env.NODE_ENV || "development";
  // Used by `src/app/version.js`.
  raw.SOURCECRED_GIT_STATE = SOURCECRED_GIT_STATE;
  // Used by `src/app/credExplorer/App.js`.
  raw.SOURCECRED_FEEDBACK_URL = SOURCECRED_FEEDBACK_URL;

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
