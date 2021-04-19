// @flow

import {TaskManager} from "./taskManager";

import {SilentTaskReporter} from "./taskReporter";

describe("util/taskManager", () => {
  class TestCase {
    taskManager: TaskManager;
    reporter: SilentTaskReporter;
    constructor() {
      this.reporter = new SilentTaskReporter();
      this.taskManager = new TaskManager(this.reporter);
    }
    start(task: string): TaskManager {
      return this.taskManager.start(task);
    }
    finish(task: string): TestCase {
      this.taskManager.finish(task);
      return this;
    }
  }
  it("errors when finishing an unregistered task", () => {
    const fail = () => new TestCase().finish("foo");
    expect(fail).toThrowError("Task foo not registered");
  });
  it("errors when starting a a task twice", () => {
    const testCase = new TestCase();
    testCase.start("foo");
    const fail = () => testCase.start("foo");
    expect(fail).toThrow("Task foo already registered");
  });
  it("errors when finishing a task twice", () => {
    const testCase = new TestCase();
    testCase.start("foo");
    testCase.finish("foo");
    const fail = () => testCase.finish("foo");
    expect(fail).toThrow("Task foo not registered");
  });
  it("works when a parent task is started with a child and finishes, terminating both tasks", () => {
    const testCase = new TestCase();
    const fooScope = testCase.start("foo");
    expect(testCase.reporter.entries()).toEqual([
      {"taskId": "foo", "type": "START"},
    ]);
    fooScope.start("test");
    testCase.finish("foo");
    expect(testCase.reporter.entries()).toEqual([
      {"taskId": "foo", "type": "START"},
      {"taskId": "foo: test", "type": "START"},
      {"taskId": "foo: test", "type": "FINISH"},
      {"taskId": "foo", "type": "FINISH"},
    ]);
  });
  it("works when a child task starts and finishes", () => {
    const testCase = new TestCase();
    const fooScope = testCase.start("foo");
    expect(testCase.reporter.entries()).toEqual([
      {"taskId": "foo", "type": "START"},
    ]);
    fooScope.start("test");
    fooScope.finish("test");
    expect(testCase.reporter.entries()).toEqual([
      {"taskId": "foo", "type": "START"},
      {"taskId": "foo: test", "type": "START"},
      {"taskId": "foo: test", "type": "FINISH"},
    ]);
  });

  describe("Scoped TaskManager", () => {
    it("cannot terminate tasks outside of scope", () => {
      const testCase = new TestCase();
      const scoped = testCase.start("ctx1");
      testCase.start("ct");
      const fail = () => scoped.finish("ct");
      expect(fail).toThrow("Task ct not registered");
    });
    it("cannot terminate scope root", () => {
      const testCase = new TestCase();
      const scoped = testCase.start("ctx1");
      const fail = () => scoped.finish("");
      expect(fail).toThrow("Task  not registered");
    });
    it("can create and and finish tasks", () => {
      const testCase = new TestCase();
      const scoped = testCase.start("ctx1");
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
