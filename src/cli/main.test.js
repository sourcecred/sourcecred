// @flow

import main from "./main";
import sourcecred from "./sourcecred";

jest.mock("./sourcecred");

const sourcecredMock: JestMockFn<any, any> = sourcecred;
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});
const logMock: JestMockFn<any, void> = console.log;
const errorMock: JestMockFn<any, void> = console.error;

describe("cli/main", () => {
  beforeEach(() => {
    sourcecredMock.mockReset();
    logMock.mockClear();
    errorMock.mockClear();
  });

  it("forwards the exit code", async () => {
    process.argv = ["node", "sourcecred", "help"];
    sourcecredMock.mockResolvedValueOnce(22);
    await main();
    expect(process.exitCode).toBe(22);
  });

  it("forwards arguments", async () => {
    process.argv = ["node", "sourcecred", "help", "me"];
    sourcecredMock.mockResolvedValueOnce(0);
    await main();
    expect(sourcecredMock).toHaveBeenCalledTimes(1);
    expect(sourcecredMock).toHaveBeenCalledWith(["help", "me"], {
      out: expect.any(Function),
      err: expect.any(Function),
    });
    expect(process.exitCode).toBe(0);
  });

  it("forwards stdout and stderr", async () => {
    process.argv = ["node", "sourcecred", "help"];
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    sourcecredMock.mockImplementation(async (args, std) => {
      std.out("out and away");
      std.err("err, what?");
      return 0;
    });
    await main();
    expect(logMock.mock.calls).toEqual([["out and away"]]);
    expect(errorMock.mock.calls).toEqual([["err, what?"]]);
    expect(process.exitCode).toBe(0);
  });

  it("captures an error", async () => {
    process.argv = ["node", "sourcecred", "wat"];
    jest.spyOn(console, "error").mockImplementation(() => {});
    sourcecredMock.mockImplementationOnce(() => {
      throw new Error("wat");
    });
    await main();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching("Error: wat")
    );
    expect(process.exitCode).toBe(1);
  });

  it("captures a rejection", async () => {
    process.argv = ["node", "sourcecred", "wat"];
    jest.spyOn(console, "error").mockImplementation(() => {});
    sourcecredMock.mockRejectedValueOnce("wat?");
    await main();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('"wat?"');
    expect(process.exitCode).toBe(1);
  });
});
