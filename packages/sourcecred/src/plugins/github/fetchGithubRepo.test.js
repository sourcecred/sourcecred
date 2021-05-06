// @flow

import {_guessTypename, _resolveRefreshTime} from "./fetchGithubRepo";

describe("plugins/github/fetchGithubRepo", () => {
  describe("_guessTypename", () => {
    it("guesses a User typename", () => {
      // Simple case.
      const id = "MDQ6VXNlcjQzMTc4MDY=";
      expect(_guessTypename(id)).toEqual("User");
    });
    it("guesses a Commit typename", () => {
      // Multiple decoded parts.
      const id =
        "MDY6Q29tbWl0MTIwMTQ1NTcwOjljYmEwZTllMjEyYTI4N2NlMjZlOGQ3YzJkMjczZTEwMjVjOWY5YmY=";
      expect(_guessTypename(id)).toEqual("Commit");
    });
    it("guesses an X509Certificate typename", () => {
      // Numbers in the middle of the typename.
      // (I made this object ID up; I couldn't find a real one.)
      const id = "MDEyOlg1MDlDZXJ0aWZpY2F0ZTEyMzQ1";
      expect(_guessTypename(id)).toEqual("X509Certificate");
    });
    it("fails cleanly on an unknown ID format", () => {
      const id = ":spooky:";
      expect(_guessTypename(id)).toBe(null);
    });
  });

  describe("resolveRefreshTime", () => {
    const now = () => new Date(981162245678); // 2001-02-03 01:04:05.678 UTC
    const oneMinuteMs = 60 * 1000;
    const oneHourMs = 60 * 60 * 1000;

    function spyWarn(): JestMockFn<[string], void> {
      return ((console.warn: any): JestMockFn<any, void>);
    }
    beforeEach(() => {
      jest.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => {
      try {
        expect(console.warn).not.toHaveBeenCalled();
      } finally {
        spyWarn().mockRestore();
      }
    });

    it("clamps dates in the past", () => {
      const result = _resolveRefreshTime(now(), new Date(+now() - 1));
      expect(result).toEqual(new Date(+now() + oneMinuteMs));
      expect(console.warn).toHaveBeenCalledWith(
        "clamping refresh delay from -1 ms to 0 ms"
      );
      spyWarn().mockReset();
    });

    it("clamps dates in the far future", () => {
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      const result = _resolveRefreshTime(now(), new Date(+now() + oneWeekMs));
      expect(result).toEqual(new Date(+now() + oneHourMs + oneMinuteMs));
      expect(console.warn).toHaveBeenCalledWith(
        `clamping refresh delay from ${oneWeekMs} ms to ${oneHourMs} ms`
      );
      spyWarn().mockReset();
    });

    it("pads reasonable dates", () => {
      const fiveMinutesMs = 5 * 60 * 1000;
      const result = _resolveRefreshTime(
        now(),
        new Date(+now() + fiveMinutesMs)
      );
      expect(result).toEqual(new Date(+now() + fiveMinutesMs + oneMinuteMs));
    });
  });
});
