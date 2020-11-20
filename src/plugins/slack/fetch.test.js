/**
 * @jest-environment node
 */
// @flow

import {Fetcher} from "./fetch";
import {token, users, channels, messages} from "./testUtils/data.json";

describe("plugins/slack/fetch", () => {
  const fetcher = new Fetcher(token);
  jest.setTimeout(30000); // 30 seconds timeout (takes longer due to pagination)

  describe("testing with the kernel org", () => {
    it("loads users", async () => {
      const _users = await fetcher.users();
      expect(_users).toEqual(users);
    });

    it("loads channels", async () => {
      const _channels = await fetcher.channels();
      expect(_channels).toEqual(channels);
    });

    it("loads messages", async () => {
      const channel = channels[0];
      const _messages = await fetcher.messages(channel);
      expect(_messages).toEqual(messages);
    });
  });
});
