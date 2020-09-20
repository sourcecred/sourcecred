// @flow

import {
  type TaskId,
  type TaskReporter,
  ScopedTaskReporter,
  SilentTaskReporter,
} from "./taskReporter";

type TaskNodeId = string;
type RootedTaskId = TaskNodeId[];
type TaskNode = {|
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

  constructor(rootNode: ?TaskNode) {
    this._taskRoot = rootNode || createNode();
  }

  start(id: TaskId) {
    const rootId = fromTaskId(id);
    if (this.findTask(rootId)) {
      throw new Error(`Task ${id} already registered`);
    }
    this._createTask(rootId);
    return this;
  }

  finish(id: TaskId) {
    const rootId = fromTaskId(id);
    if (!this.findTask(rootId)) {
      throw new Error(`Task ${id} not registered`);
    }
    this._findandFinishTask(rootId);
    return this;
  }

  createScope(id: TaskId): TaskManager {
    const rootId = fromTaskId(id);
    const contextRoot = this.findTask(rootId);
    if (!contextRoot) {
      throw new Error(`task ${id} not registered`);
    }
    return new TaskManager(contextRoot);
  }

  findTask(rootId: RootedTaskId, node: TaskNode = this._taskRoot): ?TaskNode {
    // don't want to modify the Id passed into findTask here
    // so we create and operate on a duplicate
    const idCopy = [...rootId];
    if (!rootId.length) return node;
    const id = idCopy.shift();
    const child = node.children.get(id);
    if (child) {
      return this.findTask(idCopy, child);
    }
  }

  _createTask(rootId: RootedTaskId, node: TaskNode = this._taskRoot) {
    if (rootId.length === 0) return;
    const id = rootId.shift();
    let currentTask = node.children.get(id);
    if (!currentTask) {
      const newTask = createNode(new ScopedTaskReporter(node.reporter, id));
      node.children.set(id, newTask);
      node.reporter.start(id);

      currentTask = newTask;
    }
    this._createTask(rootId, currentTask);
  }

  _findandFinishTask(rootId: RootedTaskId, node: TaskNode = this._taskRoot) {
    const id = rootId.shift();
    const currentTask = node.children.get(id);
    if (rootId.length === 0) {
      this._finishTask(id, node);

      return;
    }
    this._findandFinishTask(rootId, currentTask);
  }

  _finishTask(idToKill: TaskNodeId, parent: TaskNode) {
    const tasktoKill = parent.children.get(idToKill);
    // Keep Flow Happy
    if (tasktoKill) {
      this._finishChildren(tasktoKill);
      parent.children.delete(idToKill);
      parent.reporter.finish(idToKill);
    }
  }

  _finishChildren(task: TaskNode) {
    const children = Array.from(task.children.keys());
    for (const id of children) {
      this._finishTask(id, task);
    }
  }
}

export function createNode(
  reporter: TaskReporter = new SilentTaskReporter()
): TaskNode {
  return {reporter, children: new Map()};
}

function fromTaskId(id: TaskId): RootedTaskId {
  return id.split(": ");
}
