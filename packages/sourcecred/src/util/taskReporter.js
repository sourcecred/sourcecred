// @flow

const chalk = require("chalk");

export type TaskId = string;

type MsSinceEpoch = number;
type ConsoleLog = (string) => void;
type GetTime = () => MsSinceEpoch;

export interface TaskReporter {
  start(taskId: TaskId): TaskReporter;
  finish(taskId: TaskId): TaskReporter;
}

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
export class LoggingTaskReporter implements TaskReporter {
  // Maps the task to the time
  activeTasks: Map<TaskId, MsSinceEpoch>;
  _consoleLog: ConsoleLog;
  _getTime: GetTime;

  constructor(consoleLog?: ConsoleLog, getTime?: GetTime) {
    this._consoleLog = consoleLog || console.log;
    this._getTime =
      getTime ||
      function () {
        return +new Date();
      };
    this.activeTasks = new Map();
  }

  start(taskId: TaskId): this {
    if (this.activeTasks.has(taskId)) {
      throw new Error(`task ${taskId} already registered`);
    }
    this.activeTasks.set(taskId, this._getTime());
    this._consoleLog(startMessage(taskId));
    return this;
  }

  finish(taskId: TaskId): this {
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

export type TaskEntry = {taskId: TaskId, type: "START" | "FINISH"};
/**
 * SilentTaskReporter is a task reporter that collects some information, but does not
 * emit any visible notifications.
 *
 * It can be used for testing purposes, or as a default TaskReporter for cases where
 * we don't want to default to emitting anything to console.
 *
 * Rather than emitting any messages or taking timing information, it allows retrieving
 * the sequence of task updates that were sent to the reporter.
 * This makes it easy for test code to verify that the TaskReporter was sent the right
 * sequence of tasks.
 *
 * Callers can also check what tasks are still active (e.g. to verify that there are no
 * active tasks unfinished at the end of a method.)
 */
export class SilentTaskReporter implements TaskReporter {
  _activeTasks: Set<TaskId>;
  _entries: TaskEntry[];
  constructor() {
    this._activeTasks = new Set();
    this._entries = [];
  }
  start(taskId: TaskId): this {
    if (this._activeTasks.has(taskId)) {
      throw new Error(`task ${taskId} already active`);
    }
    this._activeTasks.add(taskId);
    this._entries.push({taskId, type: "START"});
    return this;
  }
  finish(taskId: TaskId): this {
    if (!this._activeTasks.has(taskId)) {
      throw new Error(`task ${taskId} not active`);
    }
    this._activeTasks.delete(taskId);
    this._entries.push({taskId, type: "FINISH"});
    return this;
  }
  entries(): TaskEntry[] {
    return this._entries.slice();
  }
  activeTasks(): TaskId[] {
    return Array.from(this._activeTasks);
  }
}

/**
 * ScopedTaskReporter is a higher-order task reporter
 * for generating opaque scopes meant to be passed into child contexts.
 *
 * In this case, a scope is a log prefix indicating the parent context
 * in which the current task is running.
 *
 * This allows for reliable filtering and searching on existing tasks
 * by prefix. Care should be taken to ensure that the same prefix does
 * not exist in peer task contexts, so far as error handling is concerned,
 * or a filter may incorrectly catch and finish a still-running task while
 * error-handling. This risk can be mitigated by only designating prefixes via
 * a Scoped Task Reporter, as opposed to passing prefixes into the `start`
 * and `finish` methods manually. For example, this block will always throw:
 *
 * function f(top: SilentTaskReporter) {
 *  top.start("my-prefix: foo");
 *  const scoped = new ScopedTaskReporter(top, "my-prefix");
 *  scoped.start("foo"); // Error: task my-prefix: foo already active
 * }
 */
export class ScopedTaskReporter implements TaskReporter {
  _delegate: TaskReporter;
  _prefix: string;

  constructor(delegate: TaskReporter, prefix: string) {
    this._delegate = delegate;
    this._prefix = prefix;
  }

  _scoped(taskId: TaskId): TaskId {
    return `${this._prefix}: ${taskId}`;
  }

  start(taskId: TaskId): this {
    this._delegate.start(this._scoped(taskId));
    return this;
  }

  finish(taskId: TaskId): this {
    this._delegate.finish(this._scoped(taskId));
    return this;
  }
}

export function formatTimeElapsed(elapsed: MsSinceEpoch): string {
  if (elapsed < 0) {
    throw new Error("nonegative time expected");
  }
  if (elapsed < 10 * 1000) {
    return `${elapsed}ms`;
  }
  const seconds = Math.round(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) return `${seconds}s`;
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes}m ${seconds % 60}s`;
  const days = Math.floor(hours / 24);
  if (days === 0) return `${hours}h ${minutes % 60}m`;
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
