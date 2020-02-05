import fetch from "isomorphic-fetch";
import sortBy from "lodash.sortby";


const DISCORD_SERVER = "https://discordapp.com/api"
const guildid = "453243919774253079"
const channel = "543168537062014987"
const urlChannel = `${DISCORD_SERVER}/channels/${channel}`
const url = `${urlChannel}/messages?667618906734592031&limit=100`
const CLIENT_ID = "673208303567765516"
const CLIENT_SECRET = "sRemXufBbspQ6akkk_n-eSq3uQejYmv_"
const redirect = "http://localhost:8000"

// const url3 = "https://discordapp.com/api/oauth2/authorize?client_id=673208303567765516&redirect_uri=http%3A%2F%2Flocalhost%3A8000&response_type=code&scope=guilds"

const fetchOptions = {
  method: "GET",
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'authorization': 'NDM5MDUwODU3OTIxOTA0NjQw.XhOsNQ.opNQfOaD5lR2yxIb31AWrifU5Wo'
  }
}

//before=667596440058462209

const postRequest = (before) => {
  if (before !== null) {
    return fetch(url + `&before=${before}`, fetchOptions)
  } else {
    return fetch(url, fetchOptions)
  }
}

export const f = () => {
  // fetch(url, fetchOptions).then((response) => {
  //   response.json().then((x) =>
  //   {
  //       const messages = x
  //       for (const message of messages) {
  //         console.log(message)
  //       }
  //   })
  // })
  loadMessages(postRequest, null)
}

//reactions/%F0%9F%91%8D/%40me

function emojiQuery(reaction) {
  const name = reaction.emoji.name
  const id = reaction.emoji.id
  const encodedName = encodeURI(`${reaction.emoji.name}`)
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
  const url = `${urlChannel}/messages/${message.id}/reactions/${query}?limit=100`
  // const url = "https://discordapp.com/api/v6/channels/543168537062014987/messages/674125310228430858/reactions/sourcecred%3A626763367893303303?limit=100"
  console.log(`fetching url ${url}`)
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


async function loadMessages(postRequest, before) {
  try {
    const response = await postRequest(before)
    const messages = await response.json()

    for (const message of messages) {
      const reactions = message.reactions
      if (reactions !== undefined) {
        for (const reaction of reactions) {
          fetchReactions(message, reaction)
        }
      }
    }

    if (messages.length > 0) {
      const lastMessage = sortBy(messages, (x) => x.timestamp)[0]
      //loadMessages(postRequest, lastMessage.id)

    } else {

    }

  } catch (err) {
    console.log(err)
 }
}
