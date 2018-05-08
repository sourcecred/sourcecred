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
      cmd: ["npm", "run", "--silent", "flow"],
      deps: [],
    },
    {
      id: "ci-test",
      cmd: ["npm", "run", "--silent", "ci-test"],
      deps: [],
    },
    {
      id: "backend",
      cmd: ["npm", "run", "--silent", "backend"],
      deps: [],
    },
  ];
  const extraTasks = [
    {
      id: "fetchGithubRepoTest",
      cmd: ["./src/plugins/github/fetchGithubRepoTest.sh", "--no-build"],
      deps: ["backend"],
    },
    {
      id: "loadRepositoryTest",
      cmd: ["./src/plugins/git/loadRepositoryTest.sh", "--no-build"],
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
