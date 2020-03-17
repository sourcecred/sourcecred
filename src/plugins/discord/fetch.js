// @no-flow
import fetch from "isomorphic-fetch";
import sortBy from "lodash.sortby";
import retry from "retry";

const DISCORD_SERVER = "https://discordapp.com/api";
const guildid = "453243919774253079";
const channel = "543168537062014987";
const urlChannel = `${DISCORD_SERVER}/channels/${channel}`;
// const url = `${urlChannel}/messages?667618906734592031&limit=100&around=0`;

const fetchOptions = {
  method: "GET",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    authorization:
      "NDM5MDUwODU3OTIxOTA0NjQw.XhOsNQ.opNQfOaD5lR2yxIb31AWrifU5Wo",
  },
};

function rejectRateLimitedResponse(url, fetchOptions) {
  return fetch(url, fetchOptions).then((response) => {
    if (response.status === 429) {
      return Promise.reject({retry: true, response: response});
    } else {
      return Promise.resolve(response);
    }
  });
}

function retryFetch(url, fetchOptions) {
  return new Promise((resolve, reject) => {
    const operation = retry.operation();
    operation.attempt(() => {
      rejectRateLimitedResponse(url, fetchOptions)
        .then((result) => {
          resolve(result);
        })
        .catch((error) => {
          console.log(error);

          if (error.retry && operation.retry(true)) {
            return;
          } else {
            reject(error);
          }
        });
    });
  });
}

const getChannels = async () => {
  // consider before token
  const url = `${DISCORD_SERVER}/guilds/${guildid}/channels`;
  const response = await retryFetch(url, fetchOptions);
  const channels = await response.json();
  return channels;
};

const getMessages = async (url) => {
  try {
    const response = await retryFetch(url, fetchOptions);
    return response;
  } catch (error) {
    console.log(error);
  }
};

function emojiQuery(reaction) {
  const name = reaction.emoji.name;
  const id = reaction.emoji.id;
  const encodedName = encodeURI(name);
  if (name === null && id === null) {
    return "";
  } else if (name === null) {
    return id;
  } else if (id === null) {
    return encodedName;
  } else {
    return `${encodedName}%3A${id}`;
  }
}

async function fetchReactions(message, reaction) {
  const query = emojiQuery(reaction);
  const url = `${urlChannel}/messages/${message.id}/reactions/${query}?limit=100&around=0`;
  // const url = "https://discordapp.com/api/v6/channels/543168537062014987/messages/674125310228430858/reactions/sourcecred%3A626763367893303303?limit=100"
  try {
    const response = await retryFetch(url, fetchOptions);
    const data = await response.json();

    if (data.code === 10014) {
      console.log("[discord.fetchReactions] unknown emoji");
    }
  } catch (e) {
    console.log(e);
    console.log(url);
  }
}

export const fetchDiscord = async () => {
  const channels = await getChannels();
  var messageCount = 0;

  for (const channel of channels) {
    var mostRecentMessageId = null;
    var proceed = true;
    var baseurl = `${DISCORD_SERVER}/channels/${channel.id}/messages?limit=100`;
    console.log(`fetching channel: ${channel.name}`);

    while (proceed) {
      var url = null;
      if (mostRecentMessageId === null) {
        url = baseurl + `&around=0`;
      } else {
        url = baseurl + `&after=${mostRecentMessageId}`;
      }
      const response = await getMessages(url);

      if (response.status !== 200) {
        console.log(response);
        break;
      }
      const messages = await response.json();
      messageCount += messages.length;

      for (const message of messages) {
        const reactions = message.reactions || [];
        for (const reaction of reactions) {
          if (reaction.emoji.name === "sourcecred") {
            fetchReactions(message, reaction);
          }
        }
      }

      if (messages.length === 0) {
        proceed = false;
        break;
      }

      mostRecentMessageId = sortBy(messages, (x) => x.timestamp)[
        messages.length - 1
      ].id;
      console.log("total message count: " + messageCount);
    }
  }
};
