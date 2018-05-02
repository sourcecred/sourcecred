// @flow

const chalk = require("chalk");
const child_process = require("child_process");

/*::
type TaskId = string;
type Task = {|
  +id: TaskId,
  +cmd: $ReadOnlyArray<string>,
  +deps: $ReadOnlyArray<TaskId>,
|};

type TaskResult = {|
  +id: TaskId,
  +success: boolean,
  +status: number,
  +stdout: string,
  +stderr: string,
|};
*/

function main() {
  const mode =
    process.env["TRAVIS_EVENT_TYPE"] === "cron" ||
    process.argv.includes("--full")
      ? "FULL"
      : "BASIC";
  processAll(makeTasks(mode));
}
main();

async function processAll(tasks /*: $ReadOnlyArray<Task> */) {
  const tasksById /*: {[TaskId]: Task} */ = {};
  tasks.forEach((task) => {
    if (tasksById[task.id] !== undefined) {
      throw new Error("Duplicate tasks with ID: " + task.id);
    }
    tasksById[task.id] = task;
  });

  const completedTasks /*: Map<TaskId, TaskResult> */ = new Map();
  const tasksInProgress /*: Map<TaskId, Promise<TaskResult>> */ = new Map();
  const remainingTasks /*: Set<TaskId> */ = new Set(Object.keys(tasksById));

  function spawnTasksWhoseDependenciesHaveCompleted() {
    for (const task of tasks) {
      if (!remainingTasks.has(task.id)) {
        continue;
      }
      if (incompleteDependencies(task).length > 0) {
        continue;
      }
      // Ready to spawn!
      remainingTasks.delete(task.id);
      console.log(chalk.bgBlue.bold.white("  GO  ") + " " + task.id);
      tasksInProgress.set(task.id, processOne(task));
    }
  }

  function incompleteDependencies(task /*: Task */) /*: TaskId[] */ {
    return task.deps.filter((dep) => {
      const result = completedTasks.get(dep);
      return !(result && result.success);
    });
  }

  async function awaitAnyTask() {
    if (tasksInProgress.size === 0) {
      throw new Error("Invariant violation: No tasks to wait for.");
    }
    const result /*: TaskResult */ = await Promise.race(
      Array.from(tasksInProgress.values())
    );
    tasksInProgress.delete(result.id);
    completedTasks.set(result.id, result);
    displayResult(result.id, result, "OVERVIEW");
  }

  function displayResult(
    id /*: TaskId */,
    result /*: ?TaskResult */,
    mode /*: "OVERVIEW" | "FULL" */
  ) {
    const success = result && result.success;
    const badge = success
      ? chalk.bgGreen.bold.white(" PASS ")
      : chalk.bgRed.bold.white(" FAIL ");
    console.log(`${badge} ${id}`);

    if (mode === "OVERVIEW" && success) {
      return;
    }

    let loggedAnything = false;
    function log(...args) {
      console.log(...args);
      loggedAnything = true;
    }
    if (!result) {
      log(`Did not run. Missing dependencies:`);
      incompleteDependencies(tasksById[id]).forEach((dep) => {
        log(`  - ${dep}`);
      });
      log();
      return;
    }
    if (result.status !== 0) {
      log("Exit code: " + result.status);
    }
    if (result.stdout.length > 0) {
      log("Contents of stdout:");
      displayOutputStream(result.stdout);
    }
    if (result.stderr.length > 0) {
      log("Contents of stderr:");
      displayOutputStream(result.stderr);
    }
    if (loggedAnything) {
      console.log();
    }
  }

  function displayOutputStream(streamContents /*: string */) {
    streamContents.split("\n").forEach((line, index, array) => {
      if (line === "" && index === array.length - 1) {
        return;
      } else {
        console.log("    " + line);
      }
    });
  }

  function printSection(name /*: string */) {
    console.log("\n" + chalk.bold(name));
  }

  printSection("Starting tasks");
  spawnTasksWhoseDependenciesHaveCompleted();
  while (tasksInProgress.size > 0) {
    await awaitAnyTask();
    spawnTasksWhoseDependenciesHaveCompleted();
  }

  if (remainingTasks.size > 0) {
    printSection("Unreachable tasks");
    Array.from(remainingTasks.values()).forEach((line) => {
      console.log(`  - ${line}`);
    });
  }

  printSection("Full results");
  for (const task of tasks) {
    const result = completedTasks.get(task.id);
    displayResult(task.id, result, "FULL");
  }

  printSection("Overview");
  const failedTasks = tasks.map((t) => t.id).filter((id) => {
    const result = completedTasks.get(id);
    return !result || !result.success;
  });
  if (failedTasks.length > 0) {
    console.log("Failed tasks:");
    failedTasks.forEach((line) => {
      console.log(`  - ${line}`);
    });
  }
  const overallSuccess /*: boolean */ = failedTasks.length === 0;
  const overallBadge = overallSuccess
    ? chalk.bgGreen.bold.white(" SUCCESS ")
    : chalk.bgRed.bold.white(" FAILURE ");
  console.log("Final result: " + overallBadge);
  process.exitCode = overallSuccess ? 0 : 1;
}

function processOne(task /*: Task */) /*: Promise<TaskResult> */ {
  if (task.cmd.length === 0) {
    throw new Error("Empty command for task: " + task.id);
  }
  const file = task.cmd[0];
  const args = task.cmd.slice(1);
  return new Promise((resolve, _unused_reject) => {
    child_process.execFile(file, args, (error, stdout, stderr) => {
      resolve({
        id: task.id,
        success: !error,
        status: error ? error.code : 0,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
      });
    });
  });
}

function makeTasks(mode /*: "BASIC" | "FULL" */) {
  const basicTasks = [
    {
      id: "check-pretty",
      cmd: ["npm", "run", "check-pretty"],
      deps: [],
    },
    {
      id: "lint",
      cmd: ["npm", "run", "lint"],
      deps: [],
    },
    {
      id: "flow",
      cmd: ["npm", "run", "flow"],
      deps: [],
    },
    {
      id: "ci-test",
      cmd: ["npm", "run", "ci-test"],
      deps: [],
    },
  ];
  const extraTasks = [
    {
      id: "backend",
      cmd: ["npm", "run", "backend"],
      deps: [],
    },
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
