// @flow

const chalk = require("chalk");

type TaskId = string;

type MsSinceEpoch = number;
type ConsoleLog = (string) => void;
type GetTime = () => MsSinceEpoch;

/**
 * This class is a lightweight utility for reporting task progress to the
 * command line.
 *
 * - When a task is started, it's printed to the CLI with a " GO " label.
 * - When it's finished, it's printed with a "DONE" label, along with the time
 * elapsed.
 * - Tasks are tracked and represented by string id.
 * - The same task id may be re-used after the first task with that id is
 * finished.
 */
export class TaskReporter {
  // Maps the task to the time
  activeTasks: Map<TaskId, MsSinceEpoch>;
  _consoleLog: ConsoleLog;
  _getTime: GetTime;

  constructor(consoleLog?: ConsoleLog, getTime?: GetTime) {
    this._consoleLog = consoleLog || console.log;
    this._getTime =
      getTime ||
      function() {
        return +new Date();
      };
    this.activeTasks = new Map();
  }

  start(taskId: TaskId) {
    if (this.activeTasks.has(taskId)) {
      throw new Error(`task ${taskId} already registered`);
    }
    this.activeTasks.set(taskId, this._getTime());
    this._consoleLog(startMessage(taskId));
    return this;
  }

  finish(taskId: TaskId) {
    const startTime = this.activeTasks.get(taskId);
    if (startTime == null) {
      throw new Error(`task ${taskId} not registered`);
    }
    const elapsedTime = this._getTime() - startTime;
    this._consoleLog(finishMessage(taskId, elapsedTime));
    this.activeTasks.delete(taskId);
    return this;
  }
}

export function formatTimeElapsed(elapsed: MsSinceEpoch): string {
  if (elapsed < 0) {
    throw new Error("nonegative time expected");
  }
  if (elapsed < 1000) {
    return `${elapsed}ms`;
  }
  const seconds = Math.round(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes == 0) return `${seconds}s`;
  const hours = Math.floor(minutes / 60);
  if (hours == 0) return `${minutes}m ${seconds % 60}s`;
  const days = Math.floor(hours / 24);
  if (days == 0) return `${hours}h ${minutes % 60}m`;
  return `${days}d ${hours % 24}h`;
}

export function startMessage(taskId: string): string {
  const label = chalk.bgBlue.bold.white("  GO  ");
  const message = `${label} ${taskId}`;
  return message;
}

export function finishMessage(taskId: string, elapsedTimeMs: number): string {
  const elapsed = formatTimeElapsed(elapsedTimeMs);
  const label = chalk.bgGreen.bold.white(" DONE ");
  const message = `${label} ${taskId}: ${elapsed}`;
  return message;
}
