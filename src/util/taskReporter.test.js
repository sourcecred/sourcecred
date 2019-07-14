// @flow

import {
  TaskReporter,
  formatTimeElapsed,
  startMessage,
  finishMessage,
} from "./taskReporter";

describe("util/taskReporter", () => {
  describe("formatTimeElapsed", () => {
    function tc(expected, ms) {
      it(`works for ${expected}`, () => {
        expect(formatTimeElapsed(ms)).toEqual(expected);
      });
    }
    tc("0ms", 0);
    tc("50ms", 50);
    tc("999ms", 999);
    const secs = 1000;
    tc("1s", 1 * secs + 400);
    tc("2s", 1 * secs + 600);
    tc("59s", 59 * secs);
    const mins = secs * 60;
    tc("1m 3s", mins + 3 * secs);
    tc("59m 59s", 59 * mins + 59 * secs);
    const hours = mins * 60;
    tc("1h 0m", hours);
    tc("1h 3m", hours + mins * 3);
    tc("23h 59m", 23 * hours + 59 * mins);
    const days = 24 * hours;
    tc("1d 0h", days);
    tc("555d 23h", 555 * days + 23 * hours);
  });

  describe("TaskReporter", () => {
    class TestCase {
      _time: number;
      messages: string[];
      taskReporter: TaskReporter;

      constructor() {
        this._time = 0;
        this.messages = [];
        const logMock = (x) => {
          this.messages.push(x);
        };
        const timeMock = () => this._time;
        this.taskReporter = new TaskReporter(logMock, timeMock);
      }
      start(task: string) {
        this.taskReporter.start(task);
        return this;
      }
      finish(task: string) {
        this.taskReporter.finish(task);
        return this;
      }
      time(t: number) {
        this._time = t;
        return this;
      }
    }

    it("errors when finishing an unregistered task", () => {
      const fail = () => new TestCase().finish("foo");
      expect(fail).toThrowError("task foo not registered");
    });
    it("errors when starting a task twice", () => {
      const fail = () => new TestCase().start("foo").start("foo");
      expect(fail).toThrowError("task foo already registered");
    });
    it("errors when finishing a task twice", () => {
      const fail = () =>
        new TestCase()
          .start("foo")
          .finish("foo")
          .finish("foo");
      expect(fail).toThrowError("task foo not registered");
    });

    it("works for a task that immediately finishes", () => {
      const {messages} = new TestCase().start("foo").finish("foo");
      expect(messages).toEqual([startMessage("foo"), finishMessage("foo", 0)]);
    });

    it("works when two tasks are started, then one finishes", () => {
      const {messages} = new TestCase()
        .start("foo")
        .start("bar")
        .time(200)
        .finish("foo");
      expect(messages).toEqual([
        startMessage("foo"),
        startMessage("bar"),
        finishMessage("foo", 200),
      ]);
    });
    it("works when a task is started, finished, and re-started", () => {
      const {messages} = new TestCase()
        .start("foo")
        .finish("foo")
        .start("foo")
        .time(200)
        .finish("foo");
      expect(messages).toEqual([
        startMessage("foo"),
        finishMessage("foo", 0),
        startMessage("foo"),
        finishMessage("foo", 200),
      ]);
    });
  });
});
