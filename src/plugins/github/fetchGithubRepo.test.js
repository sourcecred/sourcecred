// @flow

import {_guessTypename} from "./fetchGithubRepo";

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
});
