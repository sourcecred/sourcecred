<a name="DiscordFetcher"></a>

## DiscordFetcher
Fetcher is responsible for:
- Returning the correct endpoint to fetch against for Guilds, Channels,
  Members, and Reactions.
- Formatting the returned results into the correct Typed objects
- Returning pagination info in a PageInfo object, containing hasNextPage
  and endCursor properties.
  The endCursor property is calculated as the Id of the last object
  returned in the response results. We are assuming Discord provides
  consistent, ordered results.
  The hasNextPage property is a boolean calculated as whether the number of
  results recieved is equal to the `limit` property provided in the
  fetch request.

  Note that Discord doesn't support pagination for Channels, so we're
  returning an array of Channel objects in the corresponding method.
  See: https://discordapp.com/developers/docs/resources/guild#get-guild-channels

**Kind**: global class  
