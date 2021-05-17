// @flow

import {
  type TaskId,
  type TaskReporter,
  ScopedTaskReporter,
  SilentTaskReporter,
} from "./taskReporter";

/**
 * TaskManager organizes and maintains a hierarchy of active tasks
 *
 * It utilizes TaskReporters internally for logging, and allows them to
 * maintain their own task state for internal use. The primary concern of
 * the manager is creating and enforcing task scopes via a tree structure.
 *
 * Scopes
 * A parent task can safely manage its own subset of tasks through the use of
 * scopes. TaskManager.prototype.start returns a new new TaskManager instance
 * that is rooted on the newly created task. For this reason, TaskManager does not
 * implement the TaskReporter interface.
 *
 * Motivation
 * When a task needs to be terminated, it is important that all its child tasks
 * also finish, especially the in the case of a restart. A well-behaved task should
 * terminate all tasks it spawns within its own context, but in the case of an
 * unexpected error, this class makes it possible to quickly find and safely terminate
 * all child tasks.
 */
export class TaskManager {
  _reporter: TaskReporter;
  _children: Map<TaskId, TaskManager>;

  constructor(reporter?: TaskReporter) {
    this._reporter = reporter || new SilentTaskReporter();
    this._children = new Map();
  }

  start(id: TaskId): TaskManager {
    if (this._findTask(id)) {
      throw new Error(`Task ${id} already registered`);
    }
    return this._createTask(id);
  }

  finish(id: TaskId): this {
    this._finishTask(id);
    return this;
  }

  _findTask(id: TaskId): ?TaskManager {
    return this._children.get(id);
  }

  _createTask(id: TaskId): TaskManager {
    const newTask = new TaskManager(new ScopedTaskReporter(this._reporter, id));
    this._children.set(id, newTask);
    this._reporter.start(id);
    return newTask;
  }

  _finishTask(idToKill: TaskId) {
    const tasktoKill = this._findTask(idToKill);
    if (!tasktoKill) {
      throw new Error(`Task ${idToKill} not registered`);
    }
    tasktoKill._finishChildren();
    this._children.delete(idToKill);
    this._reporter.finish(idToKill);
  }

  _finishChildren() {
    for (const id of this._children.keys()) {
      this._finishTask(id);
    }
  }
}
