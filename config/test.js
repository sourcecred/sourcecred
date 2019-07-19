// @flow

/*:: import type {Task} from "../src/tools/execDependencyGraph"; */

const tmp = require("tmp");

const execDependencyGraph = require("../src/tools/execDependencyGraph");

main();

function main() {
  const options = parseArgs();
  const printVerboseResults = options.mode === "FULL";
  const runOptions = {printVerboseResults};
  const tasks = makeTasks(options.mode, options.limitMemoryUsage);
  execDependencyGraph(tasks, runOptions).then(({success}) => {
    process.exitCode = success ? 0 : 1;
  });
}

function parseArgs() {
  const options = {mode: "BASIC", limitMemoryUsage: false};
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg === "--full") {
      options.mode = "FULL";
    } else if (arg === "--ci") {
      options.limitMemoryUsage = true;
    } else {
      throw new Error("unknown argument: " + JSON.stringify(arg));
    }
  }
  return options;
}

function makeTasks(
  mode /*: "BASIC" | "FULL" */,
  limitMemoryUsage /*: boolean */
) {
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
      cmd: ["yarn", "run", "--silent", "unit", "--ci"],
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
  const tasks = (function() {
    switch (mode) {
      case "BASIC":
        return basicTasks;
      case "FULL":
        return [].concat(basicTasks, extraTasks);
      default:
        /*:: (mode: empty); */ throw new Error(mode);
    }
  })();
  if (limitMemoryUsage) {
    // We've had issues with our tests flakily failing in CI, due to apparent
    // memory issues.
    //
    // This block attempts to limit memory usage by having flow to run first,
    // then stopping the flow server, then running unit tests, and only
    // afterwards running all other tasks.
    //
    // The reasoning is that the flow server is fairly memory demanding and we
    // can safely kill it after we've checked the types, and jest is also quite
    // memory intensive. Hopefully by finishing these tasks first and releasing
    // their resources, we won't have more memory exhaustion.
    tasks.forEach((task) => {
      switch (task.id) {
        case "flow":
          // Run flow first
          return;
        case "unit":
          task.cmd.push("--maxWorkers=2");
          // Run unit after we _stopped_ the flow server
          // (to free up memory from flow)
          task.deps.push("flow-stop");
          return;
        default:
          // Run everything else after unit tests
          // (unit is a memory hog)
          task.deps.push("unit");
      }
    });
    const flowStopTask /*: Task */ = {
      id: "flow-stop",
      cmd: ["yarn", "run", "--silent", "flow", "stop"],
      deps: ["flow"],
    };
    tasks.push(flowStopTask);
  }
  return tasks;
}
