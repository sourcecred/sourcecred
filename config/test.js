// @flow

const execDependencyGraph = require("../src/tools/execDependencyGraph").default;

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
      cmd: ["npm", "run", "--silent", "unit"],
      deps: [],
    },
    {
      id: "backend",
      cmd: ["npm", "run", "--silent", "backend", "--", "--dry-run"],
      deps: [],
    },
  ];
  const extraTasks = [
    {
      id: "backend-in-place",
      cmd: ["npm", "run", "--silent", "backend"],
      // This task depends on `check-pretty` in order to work around a
      // race condition in Prettier:
      // https://github.com/prettier/prettier/issues/4468
      deps: ["check-pretty"],
    },
    {
      id: "fetchGithubRepoTest",
      cmd: ["./src/plugins/github/fetchGithubRepoTest.sh", "--no-build"],
      deps: ["backend-in-place"],
    },
    {
      id: "loadRepositoryTest",
      cmd: ["./src/plugins/git/loadRepositoryTest.sh", "--no-build"],
      deps: ["backend-in-place"],
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
