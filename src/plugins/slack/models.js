// @flow

/**
 * Data model for fetched data from Slack API
 * Ways of interaction include
 * - Channels: public, private, group DMs and DMs
 * - Messages: Conversations inside channels
 * - Threads: replies to a message inside a channel
 * - Reacts: reactions left by other members of a channel on a message
 */

/**
 * OAuth token, generated from the application dashboard from
 * https://api.slack.com/apps
 * automatically generated when the app is installed to the slack org.
 */
export type SlackToken = string;

// Only humans
export type User = {|
  +id: Buffer,
  +name: string,
  +email: string,
|};

// https://api.slack.com/methods#conversations
// Conversations are channels
export type Conversation = {|
  +id: string,
  +name: string,
|};

// https://api.slack.com/events/message#stars__pins__and_reactions
// Message -> all reactions
export type MessageReaction = {|
  +name: string, // reaction name
  +users: Array<Buffer>,
  +count: Number,
|};

export type Message = {|
  +id: string, // message id (can use either client_message_id or timestamp value here, slack identifies messages uniquely using timestamp - since it is measured in microseconds)
  +channel: string, // channel id (conversation id)
  +text: string,
  +thread: Boolean, // if this is true, the message is part of a thread
  +in_reply_to: string, // id of the thread-starting message, self id = thread starting message
  +authorId: Buffer, // user id
  +reactions: Array<MessageReaction>, // array of reacts to a message. ([{name: 'reaction_name', users: ['<array of user ids>'], count: <number of reacts>}, {...}, {...}])
  +mentions: Array<Buffer>, // array of mentioned users
|};
