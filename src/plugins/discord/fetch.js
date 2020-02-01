import fetch from "isomorphic-fetch";
import sortBy from "lodash.sortby";


const DISCORD_SERVER = "https://discordapp.com/api"
const guildid = "453243919774253079"
const channel = "543168537062014987"
const url = `https://discordapp.com/api/v6/channels/${channel}/messages?667618906734592031&limit=10`
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
  const postRequest = () => fetch(url, fetchOptions)
  loadMessages(postRequest)
}


async function loadMessages(postRequest) {
  try {
    const response = await postRequest()
    const messages = await response.json()

    if (messages.length > 0) {
      const lastMessage = sortBy(messages, (x) => x.timestamp)[0]
      
    }


  } catch (err) {

  }


}
