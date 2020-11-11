// @flow
import {Client} from "pg-native";

import dedent from "../../util/dedent";

import {
  type User,
  type PostLike,
  type CommentLike,
  type Comment,
  type PostActivity,
} from "./fetch";

/**
 * Interface for reading Gitcoin data
 */
export interface ReadRepository {
  /**
   * Retrieve all Users associated with post, like or comment creation
   *
   * The order is unspecified
   */
  users(): $ReadOnlyArray<User>;
  /**
   * Retrieve all Townsquare Posts
   *
   * The order is unspecified
   */
  posts(): $ReadOnlyArray<PostActivity>;
  /**
   * Retrieve all likes associated with Posts
   *
   * The order is unspecified
   */
  postLikes(): $ReadOnlyArray<PostLike>;
  /**
   * Retrieve all likes associated with Comments
   *
   * The order is unspecified
   */
  commentLikes(): $ReadOnlyArray<CommentLike>;
  /**
   * Retrieve all Comments
   *
   * The order is unspecified
   */
  comments(): $ReadOnlyArray<Comment>;
}

/**
 * Internal interface for mirror
 */
export interface MirrorRepository extends ReadRepository {
  /**
   * Create a PostActivity from a Postgres comment row
   */
  createPost(postData: PostData): PostActivity;
  /**
   * Create a Comment from a Postgres comment row
   */
  createComment(commentData: CommentData): Comment;
  /**
   * Create a Like from a Postgres like row
   */
  createPostLike(likeData: LikeData): PostLike;
  /**
   * Creates an array of Like objects from a Postgres comment row
   */
  createLikesFromComment(commentData: CommentData): $ReadOnlyArray<CommentLike>;
  /**
   * Create a User from a Postgres user row
   */
  createUser(userData: UserData): User;
  /**
   * Retrieve all Likes associated with Posts
   *
   * The order is unspecified
   */
  postLikes(): $ReadOnlyArray<PostLike>;
  /**
   * Retrieve all Likes associated with Comments
   *
   * The order is unspecified
   */
  commentLikes(): $ReadOnlyArray<CommentLike>;
}

export class PostgresMirrorRepository
  implements ReadRepository, MirrorRepository {
  +_db: typeof Client;

  constructor(db: typeof Client) {
    this._db = db;
  }

  createPost(postData: PostData): PostActivity {
    const timestampIso = Date.parse(postData.created);

    return {
      id: postData.id,
      authorUsername: postData.handle,
      authorId: postData.profile_id,
      timestampMs: timestampIso,
    };
  }

  createComment(commentData: CommentData): Comment {
    const timestampIso = Date.parse(commentData.created_on);

    return {
      id: commentData.id,
      authorUsername: commentData.handle,
      authorId: commentData.profile_id,
      postId: commentData.activity_id,
      timestampMs: timestampIso,
    };
  }

  createPostLike(likeData: LikeData): PostLike {
    const timestampIso = Date.parse(likeData.created_on);

    return {
      id: likeData.id,
      authorUsername: likeData.handle,
      authorId: likeData.profile_id,
      postId: likeData.activity_id,
      timestampMs: timestampIso,
    };
  }

  createLikesFromComment(
    commentData: CommentData
  ): $ReadOnlyArray<CommentLike> {
    // Use comment createdOn time as likes associated with comments do not
    // have an associated timestamp
    const timestampIso = Date.parse(commentData.created_on);

    return commentData.likes.map((likeProfileId, idx) => {
      // As comment likes have no associated PK we generate a unique ID
      // based off of the associated comments PK
      const likeId = parseInt(commentData.id + "" + idx);

      return {
        id: likeId,
        authorUsername: commentData.likes_handles[idx],
        authorId: likeProfileId,
        commentId: commentData.id,
        timestampMs: timestampIso,
      };
    });
  }

  createUser(userData: UserData): User {
    const timestampIso = Date.parse(userData.created_on);

    return {
      id: userData.profile_id,
      name: userData.handle,
      timestampMs: timestampIso,
    };
  }

  posts(): $ReadOnlyArray<PostActivity> {
    return this._db
      .querySync(
        dedent`SELECT da.id,
                      da.created,
                      da.profile_id,
                      dp.handle
               FROM dashboard_activity as da,
                    dashboard_profile as dp
               WHERE da.activity_type LIKE 'status_update'
                 AND dp.id = da.profile_id`
      )
      .map(this.createPost);
  }

  comments(): $ReadOnlyArray<Comment> {
    return this._db
      .querySync(
        dedent`SELECT tc.id,
                      tc.created_on,
                      tc.activity_id,
                      tc.profile_id,
                      dp.handle
               FROM townsquare_comment as tc,
                    dashboard_profile as dp
               WHERE tc.profile_id = dp.id`
      )
      .map(this.createComment);
  }

  postLikes(): $ReadOnlyArray<PostLike> {
    return this._db
      .querySync(
        dedent`SELECT tl.id,
                      tl.created_on,
                      tl.activity_id,
                      tl.profile_id,
                      dp.handle
               FROM townsquare_like as tl,
                    dashboard_profile as dp
               WHERE tl.profile_id = dp.id`
      )
      .map(this.createPostLike);
  }

  commentLikes(): $ReadOnlyArray<CommentLike> {
    return this._db
      .querySync(
        dedent`SELECT tc.id,
                      tc.likes,
                      tc.likes_handles,
                      tc.created_on
               FROM townsquare_comment as tc`
      )
      .filter((likeData) => likeData.likes.length > 0)
      .map(this.createLikesFromComment)
      .flat();
  }

  users(): $ReadOnlyArray<User> {
    const postUsers = this._db
      .querySync(
        dedent`SELECT DISTINCT da.profile_id,
                               dp.handle,
                               dp.created_on
                      FROM dashboard_activity as da,
                           dashboard_profile as dp
                      WHERE da.activity_type
                            LIKE 'status_update'
                        AND da.profile_id = dp.id`
      )
      .map(this.createUser);

    const commentUsers = this._db
      .querySync(
        dedent`SELECT DISTINCT tc.profile_id,
                               dp.handle,
                               dp.created_on
                           FROM townsquare_comment as tc,
                                dashboard_profile as dp
                           WHERE tc.profile_id = dp.id`
      )
      .map(this.createUser);

    const likeUsers = this._db
      .querySync(
        dedent`SELECT DISTINCT tl.profile_id,
                               dp.handle,
                               dp.created_on
                            FROM townsquare_like as tl,
                                 dashboard_profile as dp
                            WHERE tl.profile_id = dp.id`
      )
      .map(this.createUser);

    const createUsersFromComment = (comment) => {
      const users = [];

      if (comment.likes && comment.likes.length > 0) {
        comment.likes.forEach((userId, idx) => {
          users.push({
            profile_id: userId,
            handle: comment.likes_handles[idx],
          });
        });
      }

      return users;
    };

    const fetchTimestamp = (user) => {
      const response = this._db.querySync(dedent`SELECT created_on
                                                 FROM
                                                    dashboard_profile as dp
                                                 WHERE
                                                    dp.id = ${user.profile_id}`);

      user.created_on = response[0].created_on;

      return user;
    };

    const commentLikeUsers = this._db
      .querySync(
        dedent`SELECT tc.likes,
                      tc.likes_handles
               FROM
                townsquare_comment as tc`
      )
      .map(createUsersFromComment)
      .flat()
      .map(fetchTimestamp)
      .map(this.createUser);

    const allUsers = [
      ...postUsers,
      ...commentUsers,
      ...likeUsers,
      ...commentLikeUsers,
    ];

    return allUsers;
  }
}

type PostData = {|
  id: number,
  handle: string,
  profile_id: number,
  created: string,
|};

type CommentData = {|
  id: number,
  handle: string,
  profile_id: number,
  activity_id: number,
  created_on: string,
  likes: $ReadOnlyArray<number>,
  likes_handles: $ReadOnlyArray<string>,
|};

type LikeData = {|
  id: number,
  handle: string,
  profile_id: number,
  activity_id: number,
  created_on: string,
|};

type UserData = {|
  profile_id: number,
  handle: string,
  created_on: string,
|};
