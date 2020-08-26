// @flow
import {type TimestampMs} from "../../util/timestamp";

export type UserId = number;
export type Username = string | null;
export type CommentId = number;
export type PostActivityId = number;
export type LikeId = number;

export type User = {|
  +id: UserId,
  +name: Username,
  +timestampMs: TimestampMs,
|};

export type Comment = {|
  +id: CommentId,
  authorUsername: Username,
  +authorId: UserId,
  +postId: PostActivityId,
  +timestampMs: TimestampMs,
|};

export type PostActivity = {|
  +id: PostActivityId,
  authorUsername: Username,
  +authorId: UserId,
  +timestampMs: TimestampMs,
|};

export type Like = {|
  +id: LikeId,
  authorUsername: Username,
  +authorId: UserId,
  +postId: PostActivityId | null,
  +commentId: CommentId | null,
  +timestampMs: TimestampMs,
|};

export type Tip = {|
  +id: TipId,
  +authorId: UserId,
  +postId: PostActivityId | null,
  +commentId: CommentId | null,
  +timestampMs: TimestampMs,
|};
