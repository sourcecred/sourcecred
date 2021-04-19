// @flow

// NOTE: This module must be written in vanilla ECMAScript that can be
// run by Node without a preprocessor. That means that we use
// `module.exports` and `require` instead of ECMAScript module keywords,
// and we use the Flow comment syntax instead of the inline syntax.

const chalk = require("chalk");
const {execFile} = require("child_process");

/*::
export type TaskId = string;
export type Task = {|
  +id: TaskId,
  +cmd: Array<string>,
  +deps: Array<TaskId>,
|};

export type TaskResult = {|
  +id: TaskId,
  +success: boolean,
  +status: number,
  +stdout: string,
  +stderr: string,
|};
export type OverallResult = {|
  +success: boolean,
|};

// For best-looking results, the task pass, fail, and launch labels
// should all be of the same width. The default options use a
// 4-character string for each. Shorter strings with length of the same
// parity can be extended by symmetrically adding spaces.
export type RunOptions = {|
  +taskPassLabel?: string,
  +taskFailLabel?: string,
  +taskLaunchLabel?: string,
  +overallPassLabel?: string,
  +overallFailLabel?: string,
  // Determines whether we print the contents of stdout and stderr for
  // all tasks (printVerboseResults === true) or just for failing tasks.
  +printVerboseResults?: boolean,
|};
*/

const defaultOptions = {
  taskPassLabel: "PASS",
  taskFailLabel: "FAIL",
  taskLaunchLabel: " GO ",
  overallPassLabel: "SUCCESS",
  overallFailLabel: "FAILURE",
  printVerboseResults: false,
};

module.exports = async function execDependencyGraph(
  tasks /*: $ReadOnlyArray<Task> */,
  options /*:: ?: RunOptions */
) /*: Promise<OverallResult> */ {
  const fullOptions = {...defaultOptions, ...(options || {})};
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

  function spacedLabel(rawLabel /*: string */) /*: string */ {
    return ` ${rawLabel} `;
  }

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
      console.log(
        chalk.bgBlue.bold.white(spacedLabel(fullOptions.taskLaunchLabel)) +
          " " +
          task.id
      );
      tasksInProgress.set(task.id, processTask(task));
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
      ? chalk.bgGreen.bold.white(spacedLabel(fullOptions.taskPassLabel))
      : chalk.bgRed.bold.white(spacedLabel(fullOptions.taskFailLabel));
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

  if (fullOptions.printVerboseResults) {
    printSection("Full results");
    for (const task of tasks) {
      const result = completedTasks.get(task.id);
      displayResult(task.id, result, "FULL");
    }
  }

  printSection("Overview");
  const failedTasks = tasks
    .map((t) => t.id)
    .filter((id) => {
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
    ? chalk.bgGreen.bold.white(spacedLabel(fullOptions.overallPassLabel))
    : chalk.bgRed.bold.white(spacedLabel(fullOptions.overallFailLabel));
  console.log("Final result: " + overallBadge);
  return Promise.resolve({success: overallSuccess});
};

function processTask(task /*: Task */) /*: Promise<TaskResult> */ {
  if (task.cmd.length === 0) {
    throw new Error("Empty command for task: " + task.id);
  }
  const file = task.cmd[0];
  const args = task.cmd.slice(1);
  return new Promise((resolve, _unused_reject) => {
    execFile(file, args, (error, stdout, stderr) => {
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
