/**
 * @jest-environment node
 */

// import { testFetcher } from './mockFetch';
import { Fetcher } from "../fetch";

/**
 * This is in no form a good test suite. Only written to check sanity of the code. Need to update to include better snapshot testing.
 */

describe ("plugins/slack/fetch", () => {
  const fetcher = new Fetcher(process.env.SLACK_TOKEN);
  jest.setTimeout(30000); // 30 seconds timeout (takes longer due to pagination)

  describe("testing with the kernel org", () => {
    it ("loads users", async () => {
    //   expect (await fetcher.users());
      const users = await fetcher.users();
      console.log ('all users:', users);
    })

    it ("loads channels", async () => {
    //   expect (await fetcher.channels());
      const channels = await fetcher.channels();
      console.log('all channels:', channels);
    })

    it ("loads messages", async() => {
      const channel = {
        id: 'C01CPGVGXSB', name: '#testing-out-things'
      }
    //   expect (await fetcher.messages(channel))
      const messages = await fetcher.messages(channel);
      console.log ('all messages:', messages);
    })

  })

})