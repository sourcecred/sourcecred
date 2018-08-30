// @flow

import main from "./main";
import sourcecred from "./sourcecred";

jest.mock("./sourcecred");

describe("cli/main", () => {
  beforeAll(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  beforeEach(() => {
    sourcecred.mockReset();
    jest.spyOn(console, "log").mockClear();
    jest.spyOn(console, "error").mockClear();
  });

  it("forwards the exit code", async () => {
    process.argv = ["node", "sourcecred", "help"];
    sourcecred.mockResolvedValueOnce(22);
    await main();
    expect(process.exitCode).toBe(22);
  });

  it("forwards arguments", async () => {
    process.argv = ["node", "sourcecred", "help", "me"];
    sourcecred.mockResolvedValueOnce(0);
    await main();
    expect(sourcecred).toHaveBeenCalledTimes(1);
    expect(sourcecred).toHaveBeenCalledWith(["help", "me"], {
      out: expect.any(Function),
      err: expect.any(Function),
    });
    expect(process.exitCode).toBe(0);
  });

  it("forwards stdout and stderr", async () => {
    process.argv = ["node", "sourcecred", "help"];
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    sourcecred.mockImplementation(async (args, std) => {
      std.out("out and away");
      std.err("err, what?");
      return 0;
    });
    await main();
    expect(console.log.mock.calls).toEqual([["out and away"]]);
    expect(console.error.mock.calls).toEqual([["err, what?"]]);
    expect(process.exitCode).toBe(0);
  });

  it("captures an error", async () => {
    process.argv = ["node", "sourcecred", "wat"];
    jest.spyOn(console, "error").mockImplementation(() => {});
    sourcecred.mockImplementationOnce(() => {
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
    sourcecred.mockRejectedValueOnce("wat?");
    await main();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('"wat?"');
    expect(process.exitCode).toBe(1);
  });
});
