// @flow

import {type Command, handlingErrors} from "./command";

describe("cli/command", () => {
  describe("handlingErrors", () => {
    it("passes through arguments appropriately", async () => {
      const expectedArgs = ["arg", "arg", "arg"];
      const expectedStdio = {out: () => {}, err: () => {}};
      let called = false;
      const cmd: Command = async (args, stdio) => {
        expect(args).toBe(expectedArgs);
        expect(args).toEqual(["arg", "arg", "arg"]);
        expect(stdio).toBe(expectedStdio);
        called = true;
        return 0;
      };
      await handlingErrors(cmd)(expectedArgs, expectedStdio);
      expect(called).toBe(true);
    });

    it("passes through a return value", async () => {
      const cmd: Command = (args) => Promise.resolve(parseInt(args[0], 10));
      const stdio = {out: () => {}, err: () => {}};
      expect(await handlingErrors(cmd)(["0"], stdio)).toBe(0);
      expect(await handlingErrors(cmd)(["1"], stdio)).toBe(1);
      expect(await handlingErrors(cmd)(["2"], stdio)).toBe(2);
    });

    it("handles a thrown Error", async () => {
      const stdio = {out: jest.fn(), err: jest.fn()};
      const cmd: Command = () => {
        throw new Error("wat");
      };
      const exitCode = await handlingErrors(cmd)([], stdio);
      expect(exitCode).toBe(1);
      expect(stdio.out).toHaveBeenCalledTimes(0);
      expect(stdio.err).toHaveBeenCalledTimes(1);
      expect(stdio.err.mock.calls[0]).toHaveLength(1);
      expect(stdio.err.mock.calls[0][0]).toMatch(/^Error: wat\n *at command/);
    });

    it("handles a thrown string", async () => {
      const stdio = {out: jest.fn(), err: jest.fn()};
      const cmd: Command = () => {
        // This is bad form, but we should try not to die in case clients do it.
        // eslint-disable-next-line no-throw-literal
        throw "wat";
      };
      const exitCode = await handlingErrors(cmd)([], stdio);
      expect(exitCode).toBe(1);
      expect(stdio.out).toHaveBeenCalledTimes(0);
      expect(stdio.err).toHaveBeenCalledTimes(1);
      expect(stdio.err.mock.calls).toEqual([['"wat"']]);
    });

    it("handles a rejection with an Error", async () => {
      const stdio = {out: jest.fn(), err: jest.fn()};
      const cmd: Command = () => Promise.reject(new Error("wat"));
      const exitCode = await handlingErrors(cmd)([], stdio);
      expect(exitCode).toBe(1);
      expect(stdio.out).toHaveBeenCalledTimes(0);
      expect(stdio.err).toHaveBeenCalledTimes(1);
      expect(stdio.err.mock.calls[0]).toHaveLength(1);
      expect(stdio.err.mock.calls[0][0]).toMatch(/^Error: wat\n *at command/);
    });

    it("handles rejection with a string", async () => {
      const stdio = {out: jest.fn(), err: jest.fn()};
      const cmd: Command = () => Promise.reject("wat");
      const exitCode = await handlingErrors(cmd)([], stdio);
      expect(exitCode).toBe(1);
      expect(stdio.out).toHaveBeenCalledTimes(0);
      expect(stdio.err).toHaveBeenCalledTimes(1);
      expect(stdio.err.mock.calls).toEqual([['"wat"']]);
    });
  });
});
