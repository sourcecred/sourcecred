// @flow

import {
  type TaskId,
  type TaskReporter,
  ScopedTaskReporter,
  SilentTaskReporter,
} from "./taskReporter";

export type TaskNode = {|
  reporter: TaskReporter,
  children: Map<TaskId, TaskNode>,
|};

/**
 * TaskManager organizes and maintains a hierarchy of active tasks
 *
 * It utilizes TaskReporters internally for logging, and allows them to
 * maintain their own task state for internal use. The primary concern of
 * the manager is creating and enforcing task scopes via a tree structure.
 *
 * Motivation
 * When a plugin task needs to be terminated in the load command, it is
 * important that all child tasks also are terminated in case a restart of the
 * task is necessary. A well-behaved plugin should terminate all tasks it
 * spawns on its own, but in the case of a cache error or other unexpected
 * error, this class makes it possible to quickly find and safely terminate all
 * child tasks.
 *
 * Scopes
 * A plugin can safely manage its own subset of tasks through the use of
 * TaskManager.prototype.createScope. An existing TaskId can be passed in to
 * create new TaskManager instance that has the plugin task as root, allowing
 * the plugin context to manage its own tasks without the possiblity of
 * terminating any out-of-scope tasks, or its own root process.
 */
export class TaskManager {
  _taskRoot: TaskNode;

  constructor(reporter?: TaskReporter) {
    this._constructor(createNode(reporter || new SilentTaskReporter()));
  }

  _constructor(rootNode: TaskNode): TaskManager {
    this._taskRoot = rootNode;
    return this;
  }

  start(id: TaskId): TaskManager {
    if (this._findTask(id)) {
      throw new Error(`Task ${id} already registered`);
    }
    const childTask = this._createTask(id);
    const newMgr = new TaskManager();
    return newMgr._constructor(childTask);
  }

  finish(id: TaskId): this {
    this._finishTask(id);
    return this;
  }

  _findTask(id: TaskId, node: TaskNode = this._taskRoot): ?TaskNode {
    return node.children.get(id);
  }

  _createTask(id: TaskId, node: TaskNode = this._taskRoot): TaskNode {
    const newTask = createNode(new ScopedTaskReporter(node.reporter, id));
    node.children.set(id, newTask);
    node.reporter.start(id);
    return newTask;
  }

  _finishTask(idToKill: TaskId, parent: TaskNode = this._taskRoot) {
    const tasktoKill = this._findTask(idToKill, parent);
    if (!tasktoKill) {
      throw new Error(`Task ${idToKill} not registered`);
    }
    this._finishChildren(tasktoKill);
    parent.children.delete(idToKill);
    parent.reporter.finish(idToKill);
  }

  _finishChildren(task: TaskNode) {
    const children = Array.from(task.children.keys());
    for (const id of children) {
      this._finishTask(id, task);
    }
  }
}

function createNode(reporter: TaskReporter): TaskNode {
  return {reporter, children: new Map()};
}
