// @flow

/**
 * Data model for fetched data from Slack API
 * Ways of interaction include 
 * - Channels: public, private, group DMs and DMs
 * - Messages: Conversations inside channels
 * - Threads: replies to a message inside a channel
 * - Reacts: reactions left by other members of a channel on a message
 */

export type SlackToken = string;

// Only humans
export type User = {|
  +id: string,
  +name: string,
  +email: string
|}

// https://api.slack.com/methods#conversations
// Conversations are channels

export type Conversation = {|
  +id: string,
  +name: string
|}

// https://api.slack.com/events/message#stars__pins__and_reactions
// export type MessageReaction = {|
//   +name: string, // reaction name
//   +users: $Array<User>
// |}

export type Message = {|
  +id: string, // message id (can use either client_message_id or timestamp value here, slack identifies messages uniquely using timestamp - since it is measured in microseconds)
  +channel: string, // channel id (conversation id)
  +text: string,
  +thread: boolean, // if this is true, the message is part of a thread
  +in_reply_to: string, // id of the thread-starting message, self id = thread starting message
  +authorId: string, // user id
  +reactions: $Array<MessageReaction>, // array of reacts to a message. MessageReaction is the name of the reaction and reacted_by
  +mentions: $Array<string> // array of mentioned users
|}
