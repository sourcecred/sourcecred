# SourceCred Discord plugin

This plugin loads data from a Discord server.

## Developer notes

Discord developer docs can be found at:
https://discordapp.com/developers/docs

### Setting up a bot

To query the API with a reasonable rate-limit, you should set up a Discord app,
and a Discord bot as part of that app.

```
Discord app
 └── Discord bot
```

You can create both on the developer portal here:
https://discordapp.com/developers/applications

Permissions this bot will need:

- `View Channels`
- `Read Message History`

Represented as `66560` integer.

Then, someone with appropriate permissions needs to invite this bot to the server.
There isn't a simple generator for this link on the dev portal, you'll need to format it yourself like this:

`https://discordapp.com/api/oauth2/authorize?client_id={{clientID}}&scope=bot&permissions={{permissionsInt}}`

And open it in the browser, as a logged-in server admin.

Read more: https://discordapp.com/developers/docs/topics/oauth2#bot-authorization-flow

### Authenticating API requests

You'll want to set your bot's token in a bot style Authorization header.

https://discordapp.com/developers/docs/reference#authentication

`Authorization: Bot MTk4NjIyNDgzNDcxOTI1MjQ4.Cl2FMQ.ZnCjm1XVW7vRze4b7Cq4se7kKWs`

### Finding configuration values / parameters

Many of the ID's you will need for configuration are exposed using the Discord client.

By enabling developer mode (under Appearance > Advanced > Developer Mode).
A right-click menu option "Copy ID" will appear.

Not every element will support this "Copy ID". For example custom emoji.
You can find some of those out by using the browser version of Discord and inspecting the DOM.

Otherwise you can also use the API and query for it yourself with tools like Postman or CURL.

With the bot invited and auth set up. Find out the Guild ID using:

`GET https://discordapp.com/api/users/@me/guilds`

Find your custom emoji using:

`GET https://discordapp.com/api/guilds/{{discordGuildId}}/emojis`
