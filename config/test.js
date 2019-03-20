// @flow

const tmp = require("tmp");

const execDependencyGraph = require("../src/tools/execDependencyGraph");

main();

function main() {
  const options = parseArgs();
  const printVerboseResults = options.mode === "FULL";
  const runOptions = {printVerboseResults};
  const tasks = makeTasks(options.mode);
  execDependencyGraph(tasks, runOptions).then(({success}) => {
    process.exitCode = success ? 0 : 1;
  });
}

function parseArgs() {
  const options = {mode: "BASIC"};
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg === "--full") {
      options.mode = "FULL";
    } else {
      throw new Error("unknown argument: " + JSON.stringify(arg));
    }
  }
  return options;
}

function makeTasks(mode /*: "BASIC" | "FULL" */) {
  const backendOutput = tmp.dirSync({
    unsafeCleanup: true,
    prefix: "sourcecred-test-",
  }).name;
  console.log("tmpdir for backend output: " + backendOutput);

  function withSourcecredBinEnv(
    invocation /*: $ReadOnlyArray<string> */
  ) /*: string[] */ {
    return ["env", "SOURCECRED_BIN=" + backendOutput, ...invocation];
  }

  const basicTasks = [
    {
      id: "ensure-flow-typing",
      cmd: ["./scripts/ensure-flow.sh"],
      deps: [],
    },
    {
      // eslint-disable-next-line no-useless-concat
      id: "check-stop" + "ships",
      // eslint-disable-next-line no-useless-concat
      cmd: ["./scripts/check-stop" + "ships.sh"],
      deps: [],
    },
    {
      id: "check-pretty",
      cmd: ["yarn", "run", "--silent", "check-pretty"],
      deps: [],
    },
    {
      id: "lint",
      cmd: ["yarn", "run", "--silent", "lint"],
      deps: [],
    },
    {
      id: "flow",
      cmd: ["yarn", "run", "--silent", "flow", "--quiet", "--max-warnings=0"],
      deps: [],
    },
    {
      id: "unit",
      cmd: ["yarn", "run", "--silent", "unit", "--ci", "--maxWorkers=4"],
      deps: [],
    },
    {
      id: "check-gnu-coreutils",
      cmd: ["./scripts/check-gnu-coreutils.sh"],
      deps: [],
    },
    {
      id: "backend",
      cmd: [
        "yarn",
        "run",
        "--silent",
        "backend",
        "--output-path",
        backendOutput,
      ],
      deps: [],
    },
    {
      id: {BASIC: "sharness", FULL: "sharness-full"}[mode],
      cmd: withSourcecredBinEnv([
        "yarn",
        "run",
        "--silent",
        {BASIC: "sharness", FULL: "sharness-full"}[mode],
      ]),
      deps: ["backend", "check-gnu-coreutils"],
    },
  ];
  const extraTasks = [
    {
      id: "fetchGithubRepoTest",
      cmd: withSourcecredBinEnv([
        "./src/plugins/github/fetchGithubRepoTest.sh",
        "--no-build",
      ]),
      deps: ["backend"],
    },
    {
      id: "fetchGithubOrgTest",
      cmd: withSourcecredBinEnv([
        "./src/plugins/github/fetchGithubOrgTest.sh",
        "--no-build",
      ]),
      deps: ["backend"],
    },
    {
      id: "loadRepositoryTest",
      cmd: withSourcecredBinEnv([
        "./src/plugins/git/loadRepositoryTest.sh",
        "--no-build",
      ]),
      deps: ["backend"],
    },
  ];
  switch (mode) {
    case "BASIC":
      return basicTasks;
    case "FULL":
      return [].concat(basicTasks, extraTasks);
    default:
      /*:: (mode: empty); */ throw new Error(mode);
  }
}
