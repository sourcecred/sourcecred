// @flow

const tmp = require("tmp");

const execDependencyGraph = require("../src/tools/execDependencyGraph");

main();

function main() {
  const mode =
    process.env["TRAVIS_EVENT_TYPE"] === "cron" ||
    process.argv.includes("--full")
      ? "FULL"
      : "BASIC";
  execDependencyGraph(makeTasks(mode)).then(({success}) => {
    process.exitCode = success ? 0 : 1;
  });
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
      cmd: ["npm", "run", "--silent", "check-pretty"],
      deps: [],
    },
    {
      id: "lint",
      cmd: ["npm", "run", "--silent", "lint"],
      deps: [],
    },
    {
      id: "flow",
      cmd: [
        "npm",
        "run",
        "--silent",
        "flow",
        "--",
        "--quiet",
        "--max-warnings=0",
      ],
      deps: [],
    },
    {
      id: "unit",
      cmd: ["npm", "run", "--silent", "unit", "--", "--ci", "--maxWorkers=4"],
      deps: [],
    },
    {
      id: "backend",
      cmd: [
        "npm",
        "run",
        "--silent",
        "backend",
        "--",
        "--output-path",
        backendOutput,
      ],
      deps: [],
    },
    {
      id: {BASIC: "sharness", FULL: "sharness-full"}[mode],
      cmd: withSourcecredBinEnv([
        "npm",
        "run",
        "--silent",
        {BASIC: "sharness", FULL: "sharness-full"}[mode],
      ]),
      deps: ["backend"],
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
