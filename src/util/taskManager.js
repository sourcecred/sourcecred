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
