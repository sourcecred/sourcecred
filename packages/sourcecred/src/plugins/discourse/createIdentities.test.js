// @flow

import {createIdentities, _createIdentity} from "./createIdentities";
import {userAddress} from "./address";
import {type User} from "./fetch";
import type {ReadRepository} from "./mirrorRepository";

describe("plugins/discourse/createIdentities", () => {
  const serverUrl = "https://example.sourcecred.io";
  describe("_createIdentity", () => {
    it("creates a standard identity correctly", () => {
      const user = {username: "foo", trustLevel: 1};
      const identity = _createIdentity(serverUrl, user);
      const expectedAlis = {
        description: "discourse/[@foo](https://example.sourcecred.io/u/foo/)",
        address: userAddress(serverUrl, "foo"),
      };
      expect(identity).toEqual({
        pluginName: "discourse",
        name: "foo",
        type: "USER",
        alias: expectedAlis,
      });
    });
    it("coerces the username correctly", () => {
      const user = {username: "coerceion?needed", trustLevel: 1};
      const identity = _createIdentity(serverUrl, user);
      expect(identity.name).toEqual("coerceion-needed");
    });
    it("sets the type to BOT for discobot and system", () => {
      const bot1 = {username: "discobot", trustLevel: 1};
      const bot2 = {username: "system", trustLevel: 1};
      for (const bot of [bot1, bot2]) {
        const identity = _createIdentity(serverUrl, bot);
        expect(identity.type).toEqual("BOT");
      }
    });
  });

  describe("createIdentities", () => {
    function mockRepositoryForUsers(
      users: $ReadOnlyArray<User>
    ): ReadRepository {
      const mockRepo = {
        users: () => users,
      };
      return (mockRepo: any);
    }
    it("handles a case with no identities", () => {
      const repo = mockRepositoryForUsers([]);
      expect(createIdentities(serverUrl, repo)).toEqual([]);
    });
    it("handles a case with no identities", () => {
      const user1 = {username: "hmm", trustLevel: 0};
      const user2 = {username: "ehh", trustLevel: 1};
      const users = [user1, user2];
      const repo = mockRepositoryForUsers(users);
      const expected = users.map((u) => _createIdentity(serverUrl, u));
      expect(createIdentities(serverUrl, repo)).toEqual(expected);
    });
  });
});
