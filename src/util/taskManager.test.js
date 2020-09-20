// @flow

import {TaskManager, createNode as createTaskNode} from "./taskManager";

import {SilentTaskReporter} from "./taskReporter";

describe("util/taskManager", () => {
  class TestCase {
    taskManager: TaskManager;
    reporter: SilentTaskReporter;
    constructor() {
      this.reporter = new SilentTaskReporter();
      this.taskManager = new TaskManager(createTaskNode(this.reporter));
    }
    start(task: string) {
      this.taskManager.start(task);
      return this;
    }
    finish(task: string) {
      this.taskManager.finish(task);
      return this;
    }
  }
  it("errors when finishing an unregistered task", () => {
    const fail = () => new TestCase().finish("foo");
    expect(fail).toThrowError("Task foo not registered");
  });
  it("errors when starting a a task twice", () => {
    const fail = () => new TestCase().start("foo").start("foo");
    expect(fail).toThrow("Task foo already registered");
  });
  it("errors when finishing a task twice", () => {
    const fail = () => new TestCase().start("foo").finish("foo").finish("foo");
    expect(fail).toThrow("Task foo not registered");
  });
  it("works when a parent task is started with a child and finishes, terminating both tasks", () => {
    const testCase = new TestCase().start("foo");
    expect(testCase.reporter.entries()).toEqual([
      {"taskId": "foo", "type": "START"},
    ]);
    testCase.start("foo: test").finish("foo");
    expect(testCase.reporter.entries()).toEqual([
      {"taskId": "foo", "type": "START"},
      {"taskId": "foo: test", "type": "START"},
      {"taskId": "foo: test", "type": "FINISH"},
      {"taskId": "foo", "type": "FINISH"},
    ]);
  });
  it("works when a child task starts and finishes", () => {
    const testCase = new TestCase().start("foo");
    expect(testCase.reporter.entries()).toEqual([
      {"taskId": "foo", "type": "START"},
    ]);
    testCase.start("foo: test").finish("foo: test");
    expect(testCase.reporter.entries()).toEqual([
      {"taskId": "foo", "type": "START"},
      {"taskId": "foo: test", "type": "START"},
      {"taskId": "foo: test", "type": "FINISH"},
    ]);
  });
  describe("task creation order", () => {
    const case0 = new TestCase().start("fo").start("fo: foo");
    const case1 = new TestCase().start("foo").start("foo: fo: f");
    it("cannot start duplicate tasks beyond root level", () => {
      const fails = [
        {task: "fo: foo", err: () => case0.start("fo: foo")},
        {task: "foo: fo", err: () => case1.start("foo: fo")},
      ];
      fails.forEach(({task, err}) => {
        expect(err).toThrow(`Task ${task} already registered`);
      });
    });
    it("can finish tasks in below the root level", () => {
      case0.finish("fo");
      case1.finish("foo: fo").finish("foo");
      expect(case0.taskManager._taskRoot.children).toEqual(new Map());
      expect(case1.taskManager._taskRoot.children).toEqual(new Map());
    });
  });

  describe("Scoped TaskManager", () => {
    it("cannot create scope on nonexistent task", () => {});
    it("cannot terminate tasks outside of scope", () => {
      const testCase = new TestCase();
      testCase.start("ctx1");
      testCase.start("ct");
      const scoped = testCase.taskManager.createScope("ctx1");
      const fail = () => scoped.finish("ct");
      expect(fail).toThrow("Task ct not registered");
    });
    it("cannot terminate scope root", () => {
      const testCase = new TestCase();
      testCase.start("ctx1");
      const scoped = testCase.taskManager.createScope("ctx1");
      const fail = () => scoped.finish("");
      expect(fail).toThrow("Task  not registered");
    });
    it("can create and and finish tasks", () => {
      const testCase = new TestCase();
      testCase.start("ctx1");
      const scoped = testCase.taskManager.createScope("ctx1");
      scoped.start("test");
      expect(testCase.reporter.entries()).toEqual([
        {
          "taskId": "ctx1",
          "type": "START",
        },
        {
          "taskId": "ctx1: test",
          "type": "START",
        },
      ]);
      scoped.finish("test");
      expect(testCase.reporter.entries()).toEqual([
        {
          "taskId": "ctx1",
          "type": "START",
        },
        {
          "taskId": "ctx1: test",
          "type": "START",
        },
        {
          "taskId": "ctx1: test",
          "type": "FINISH",
        },
      ]);
    });
  });
});
