// @flow

import {createIdentities, createIdentity} from "./createIdentities";
import {type GuildMember} from "./models";
import {memberAddress} from "./createGraph";
import {SqliteMirrorRepository} from "./mirrorRepository";

describe("plugins/discord/createIdentities", () => {
  const user = {
    bot: false,
    id: "678394436757094410",
    username: "meta",
    discriminator: "1234",
  };
  describe("createIdentity", () => {
    it("creates a standard identity correctly", () => {
      const member = {
        nick: "metadreamer",
        roles: [],
        user,
      };
      const identity = createIdentity(member);
      const expectedAlias = {
        description: "discord/metadreamer#1234",
        address: memberAddress(member),
      };
      expect(identity).toEqual({
        pluginName: "discord",
        name: "metadreamer",
        type: "USER",
        alias: expectedAlias,
      });
    });

    it("coerces the username correctly", () => {
      const member = {
        nick: "coerceion?needed?",
        roles: [],
        user,
      };
      const identity = createIdentity(member);
      expect(identity.name).toEqual("coerceion-needed-");
    });

    it("restricts the length of the name correctly", () => {
      const member = {
        nick: "123456789-123456789-123456789-123456789-123456789-",
        roles: [],
        user,
      };
      expect(member.nick.length).toBeGreaterThan(40);

      const identity = createIdentity(member);
      expect(identity.name.length).toBeLessThan(40);
    });

    it("falls back to username if member does not have a nickname set", () => {
      [undefined, null, ""].forEach((nick) => {
        const member = {
          nick,
          roles: [],
          user,
        };
        const identity = createIdentity(member);
        expect(identity.name).toEqual(user.username);
      });
    });

    it("sets the type to BOT for bot members", () => {
      const botMember = {
        nick: "123456789-123456789-123456789-123456789-123456789-",
        roles: [],
        user: {
          ...user,
          bot: true,
        },
      };
      const identity = createIdentity(botMember);

      expect(identity.type).toEqual("BOT");
    });
  });

  describe("createIdentities", () => {
    function mockRepositoryForMembers(
      members: $ReadOnlyArray<GuildMember>
    ): SqliteMirrorRepository {
      const mockRepo = {
        members: () => members,
      };
      return (mockRepo: any);
    }
    it("handles a case with no identities", () => {
      const repo = mockRepositoryForMembers([]);
      expect(createIdentities(repo)).toEqual([]);
    });
    it("handles a case with 2 identities", () => {
      const member1 = {
        nick: "member1",
        roles: [],
        user,
      };
      const member2 = {
        nick: "member2",
        roles: [],
        user: {
          ...user,
          id: "778394436757094410",
        },
      };
      const members = [member1, member2];
      const repo = mockRepositoryForMembers(members);
      const expected = members.map((m) => createIdentity(m));
      expect(createIdentities(repo)).toEqual(expected);
    });
  });
});
