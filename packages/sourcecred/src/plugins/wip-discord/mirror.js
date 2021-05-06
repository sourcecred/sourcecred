// @flow

import {type ResultPage} from "./fetcher";
import {type SqliteMirror} from "./sqliteMirror";
import {type Snowflake} from "./models";
import * as Model from "./models";
import * as nullUtil from "../../util/null";

/**
 * Mirrors data from the Discord API into a local sqlite db.
 */

const REFETCH = 50;

export async function fetchDiscord(
  sqliteMirror: SqliteMirror,
  streams: DepaginatedFetcher,
  refetchNMessages: number = REFETCH
) {
  for (const member of await streams.members()) {
    sqliteMirror.addMember(member);
  }

  for (const channel of await streams.channels()) {
    sqliteMirror.addChannel(channel);
    const endCursor: Snowflake =
      sqliteMirror.nthMessageIdFromTail(channel.id, refetchNMessages) || "0";

    for (const message of await streams.messages(channel.id, endCursor)) {
      sqliteMirror.addMessage(message);

      for (const emoji of message.reactionEmoji) {
        for (const reaction of await streams.reactions(
          channel.id,
          message.id,
          emoji
        )) {
          sqliteMirror.addReaction(reaction);
        }
      }
    }
  }
}

// Note: most of this is about wrapping pagination.
export interface DepaginatedFetcher {
  members(after: ?Snowflake): Promise<$ReadOnlyArray<Model.GuildMember>>;
  channels(): Promise<$ReadOnlyArray<Model.Channel>>;
  messages(
    channel: Snowflake,
    after: ?Snowflake
  ): Promise<$ReadOnlyArray<Model.Message>>;
  reactions(
    channel: Snowflake,
    message: Snowflake,
    emoji: Model.Emoji,
    after: ?Snowflake
  ): Promise<$ReadOnlyArray<Model.Reaction>>;
}

export async function getPages<T>(
  fetchPage: (endCursor: Snowflake) => Promise<ResultPage<T>>,
  endCursor: Snowflake
): Promise<$ReadOnlyArray<T>> {
  let after = endCursor;
  let hasNextPage = true;
  let allResults = [];

  while (hasNextPage) {
    const {results, pageInfo} = await fetchPage(after);
    allResults = allResults.concat(results);

    hasNextPage = pageInfo.hasNextPage;
    if (hasNextPage) {
      after = nullUtil.get(
        pageInfo.endCursor,
        `Found null endCursor with hasNextPage = true`
      );
    }
  }

  return allResults;
}
