import fetch from "isomorphic-fetch";
import sortBy from "lodash.sortby";


const DISCORD_SERVER = "https://discordapp.com/api"
const guildid = "453243919774253079"
const channel = "543168537062014987"
const urlChannel = `${DISCORD_SERVER}/channels/${channel}`
const url = `${urlChannel}/messages?667618906734592031&limit=100&around=0`
const CLIENT_ID = "673208303567765516"
const CLIENT_SECRET = "sRemXufBbspQ6akkk_n-eSq3uQejYmv_"
const redirect = "http://localhost:8000"

// const url3 = "https://discordapp.com/api/oauth2/authorize?client_id=673208303567765516&redirect_uri=http%3A%2F%2Flocalhost%3A8000&response_type=code&scope=guilds"
 var count = 0

const fetchOptions = {
  method: "GET",
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'authorization': 'NDM5MDUwODU3OTIxOTA0NjQw.XhOsNQ.opNQfOaD5lR2yxIb31AWrifU5Wo'
  }
}

const getChannels = async () => {
  // consider before token
  const url = `${DISCORD_SERVER}/guilds/453243919774253079/channels`
  const response = await fetch(url, fetchOptions)
  const channels = await response.json()
  return channels
}

const postRequest = (after) => {
  if (before !== null) {
    return fetch(url + `&after=${after}`, fetchOptions)
  } else {
    return fetch(url, fetchOptions)
  }
}

const getMessages =  async (url) => {
  try {
    const response = await fetch(url, fetchOptions)
    return response
  } catch (error) {
    console.log(error)
  }
}

// fetching channel: craig-moderation
// { message: 'Missing Access', code: 50001 }
// Body {
//   url: 'https://discordapp.com/api/channels/631171710800101396/messages?limit=100&around=0',
//   status: 403,
//   statusText: 'FORBIDDEN',
//   headers: Headers {


export const f = async () => {
  const channels = await getChannels()
  var count = 0
  var totalCount = 0
  var emojiCount = 0

  for (const channel of channels) {
    var mostRecentMessageId = null;
    var proceed = true;
    var baseurl = `${DISCORD_SERVER}/channels/${channel.id}/messages?limit=100`
    console.log(`fetching channel: ${channel.name}`)

    while (proceed) {
      var url = null;
      if (mostRecentMessageId === null) {
        url = baseurl + `&around=0`
      } else {
        url = baseurl + `&after=${mostRecentMessageId}`
      }
      const response = await getMessages(url)

      if (response.status !== 200) {
        console.log(response)
        break
      }
      const messages = await response.json()
      totalCount += messages.length
      console.log(totalCount + " : total count")

      for (const message of messages) {
        const reactions = message.reactions || []
        for (const reaction of reactions) {
          if (reaction.emoji.name === 'sourcecred') {
            count += 1
            console.log("sc count: " + count)
            emojiCount += reaction.count
            console.log("emopjiCount:  " + emojiCount)
          }
        }
      }

      if (messages.length === 0) {
        proceed = false
        break;
      }

      mostRecentMessageId = sortBy(messages, (x) => x.timestamp)[messages.length - 1].id
    }

    console.log(count)
  }
}

//reactions/%F0%9F%91%8D/%40me

function emojiQuery(reaction) {
  const name = reaction.emoji.name
  const id = reaction.emoji.id
  const encodedName = encodeURI(name)
  if (name === null && id === null) {
    return ''
  } else if (name === null) {
    return id
  } else if (id === null) {
    return encodedName
  } else {
    return `${encodedName}%3A${id}`
  }
}

async function fetchReactions(message, reaction) {
  const query = emojiQuery(reaction)
  const url = `${urlChannel}/messages/${message.id}/reactions/${query}?limit=100&around=0`
  // const url = "https://discordapp.com/api/v6/channels/543168537062014987/messages/674125310228430858/reactions/sourcecred%3A626763367893303303?limit=100"
  try {
    const response = await fetch(url, fetchOptions)
    const data = await response.json()

    if (data.code === 10014) {

    }

  } catch(e)  {
    console.log(e)
    console.log(url)
  }
}


async function loadMessages(postRequest, after) {

  try {
    const response = await postRequest(after)
    const messages = await response.json()
    count += messages.length
    console.log(count)

    //  console.log(messages)

    // for (const message of messages) {
    //   const reactions = message.reactions
    //   if (reactions !== undefined) {
    //     for (const reaction of reactions) {
    //       fetchReactions(message, reaction)
    //     }
    //   }
    // }

    if (messages.length > 0) {
      const firstMessage = sortBy(messages, (x) => x.timestamp)[messages.length - 1]
      loadMessages(postRequest, firstMessage.id)

    } else {

    }

  } catch (err) {
    console.log(err)
 }
}
