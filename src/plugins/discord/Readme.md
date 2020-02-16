# Discord notes:

## Bot setup

Need an app + bot.

https://discordapp.com/developers/applications

Permissions bot need:

- `View Channels`
- `Read Message History`

`66560` as integer

Create your bot invite:

https://discordapp.com/developers/docs/topics/oauth2#bot-authorization-flow

https://discordapp.com/api/oauth2/authorize?client_id={{clientID}}&scope=bot&permissions={{permissionsInt}}

## Auth

You'll want the bot auth header.
https://discordapp.com/developers/docs/reference#authentication

`Authorization: Bot MTk4NjIyNDgzNDcxOTI1MjQ4.Cl2FMQ.ZnCjm1XVW7vRze4b7Cq4se7kKWs`

## Finding parameters

With the bot invited and auth set up. Find out the Guild ID using:

`GET https://discordapp.com/api/users/@me/guilds`

Find your custom emoji using:

`GET https://discordapp.com/api/guilds/{{discordGuildId}}/emojis`

