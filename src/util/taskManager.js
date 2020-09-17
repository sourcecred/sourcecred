// @flow

import {
  type TaskId,
  type TaskReporter,
  ScopedTaskReporter,
} from "./taskReporter";

type TaskNode = {|
  id: TaskId,
  children: Map<TaskId, TaskNode>,
|};

/**
 * TaskManager organizes and maintains a hierarchy of active tasks
 *
 * It utilizes TaskReporters internally for logging, and allows them to
 * maintain their own task state for internal use. The primary concern of
 * the manager is creating and enforcing task scopes via a tree structure.
 * When a plugin task needs to be terminated in the load command, it is important
 * that all child tasks also are terminated in case a restart of the task is
 * necessary. A well-behaved plugin should terminate all tasks it spawns on its own,
 * but in the case of a cache error or other unexpected error, this class makes it
 * possible to quickly find and terminate all child tasks.
 */

export class TaskManager {
  _activeTaskRoot: TaskNode;
  reporter: TaskReporter;

  constructor(reporter: TaskReporter) {
    this.reporter = reporter;
    this._activeTaskRoot = {
      id: "",
      children: new Map(),
    };
  }

  start(taskId: TaskId) {
    if (this.findTask(taskId)) {
      throw new Error(`task ${taskId} already registered`);
    }
    this._createTask(taskId);
    return this;
  }

  finish(taskId: TaskId) {
    this._findandFinishTask(taskId);
    return this;
  }

  _createTask(taskId: TaskId, startRoot: TaskNode = this._activeTaskRoot) {
    const newTask = {
      id: taskId,
      children: new Map(),
    };
    const parent = this._findTaskParent(taskId, startRoot);
    parent.children.set(taskId, newTask);
    this.reporter.start(taskId);
  }

  _findandFinishTask(
    taskId: TaskId,
    node: TaskNode = this._activeTaskRoot,
    parent: ?TaskNode
  ) {
    if (node.id === taskId) {
      if (!parent) {
        throw new Error("Cannot kill root task");
      }
      parent.children.delete(taskId);
      this._finishTask(node);
      return;
    }
    let taskMightExist = false;
    for (const child of node.children.values()) {
      if (taskId.startsWith(child.id)) {
        taskMightExist = true;
        this._findandFinishTask(taskId, child, node);
      }
    }
    if (!taskMightExist) {
      throw new Error(`Task ${taskId} not registered`);
    }
  }

  _finishTask(task: TaskNode) {
    this._finishChildren(task);
    task.children.delete(task.id);
    this.reporter.finish(task.id);
  }

  _finishChildren(task: TaskNode) {
    const children = Array.from(task.children.values());
    for (const child of children) {
      this._finishTask(child);
    }
  }

  findTask(taskId: TaskId, node: TaskNode = this._activeTaskRoot): ?TaskNode {
    if (node.id === taskId) {
      return node;
    }
    for (const child of node.children.values()) {
      if (taskId.startsWith(child.id)) {
        return this.findTask(taskId, child);
      }
    }
  }

  createScope(taskId: TaskId): ScopedTaskManager {
    const contextRoot = this.findTask(taskId);
    if (!contextRoot) {
      throw new Error(`task ${taskId} does not exist`);
    }
    return new ScopedTaskManager(this, contextRoot);
  }

  _findTaskParent(
    taskId: TaskId,
    node: TaskNode = this._activeTaskRoot
  ): TaskNode {
    for (const child of node.children.values()) {
      if (taskId.startsWith(child.id)) {
        return this._findTaskParent(taskId, child);
      }
    }
    return node;
  }
}

export class ScopedTaskManager {
  _mgr: TaskManager;
  _subRoot: TaskNode;
  reporter: ScopedTaskReporter;

  constructor(parentManager: TaskManager, scopedRoot: TaskNode) {
    this._subRoot = scopedRoot;
    this._mgr = parentManager;
  }

  start(taskId: TaskId) {
    const fullId = this._scoped(taskId);
    if (this._mgr.findTask(fullId)) {
      throw new Error(`task ${fullId} already registered`);
    }
    this._mgr._createTask(fullId, this._subRoot);
  }

  finish(taskId: TaskId) {
    const fullId = this._scoped(taskId);
    this._mgr._findandFinishTask(fullId, this._subRoot);
  }

  _scoped(taskId: TaskId): TaskId {
    return `${this._subRoot.id}: ${taskId}`;
  }
}
