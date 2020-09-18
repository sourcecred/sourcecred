// @flow

import {
  type TaskId,
  type TaskReporter,
  ScopedTaskReporter,
  SilentTaskReporter,
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
  _taskRoot: TaskNode;
  reporter: TaskReporter;

  constructor(reporter: ?TaskReporter, rootNode: ?TaskNode) {
    this._taskRoot = rootNode || {
      id: "",
      children: new Map(),
    };
    this.reporter = reporter || new SilentTaskReporter();
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

  _createTask(taskId: TaskId, startRoot: TaskNode = this._taskRoot) {
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
    node: TaskNode = this._taskRoot,
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

  findTask(taskId: TaskId, node: TaskNode = this._taskRoot): ?TaskNode {
    if (node.id === taskId) {
      return node;
    }
    for (const child of node.children.values()) {
      if (taskId.startsWith(child.id)) {
        return this.findTask(taskId, child);
      }
    }
  }

  createScope(taskId: TaskId): TaskManager {
    const contextRoot = this.findTask(taskId);
    if (!contextRoot) {
      throw new Error(`task ${taskId} does not exist`);
    }
    return new TaskManager(
      new ScopedTaskReporter(this.reporter, taskId),
      contextRoot
    );
  }

  _findTaskParent(taskId: TaskId, node: TaskNode = this._taskRoot): TaskNode {
    for (const child of node.children.values()) {
      if (taskId.startsWith(child.id)) {
        return this._findTaskParent(taskId, child);
      }
    }
    return node;
  }
}
