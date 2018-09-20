// @flow

import * as MapUtil from "../../../util/map";
import * as RV from "../relationalView";
import * as N from "../nodes";

// MentionsAuthorReferences are inferred edges between posts.  If a post
// contains an @-mention of a user, and that user has authored any posts
// in the same thread, then we create MentionsAuthorReferences from the
// mentioning post to any posts in the same thread that were authored by
// the mentioned author.
//
// A concrete example: Suppose I write a post, and I @-mention you. Then
// my post will have MentionsAuthorReferences pointing to any posts that
// you write. The inference is that because I mentioned you by name, my
// post probably values your posts (either because I am referring to
// content you wrote in a previous post, or because I appreciate that
// you showed up to engage with me after being mentioned)
//
// See #804 for context:
// https://github.com/sourcecred/sourcecred/issues/804

export type MentionsAuthorReference = {|
  // The post that generated an mentions author reference (via @-mention)
  +src: N.TextContentAddress,
  // The post authored by the person mentioned in the src
  +dst: N.TextContentAddress,
  // The person that was mentioned in src.  Storing `who` is necessary
  // because in the case of paired authorship, there might be multiple
  // pointers from the same src to the same dst
  +who: N.UserlikeAddress,
|};

export function* findMentionsAuthorReferences(
  view: RV.RelationalView
): Iterator<MentionsAuthorReference> {
  function* issuesAndPulls() {
    yield* view.issues();
    yield* view.pulls();
  }
  for (const post of issuesAndPulls()) {
    const thread = createThread(post);
    yield* referencesFromThread(thread);
  }
}

// A post in a thread. This is either a top-level post (like an issue or
// pull request) or a child (like a comment).
type ThreadPost = {|
  // Address of the post.
  +address: N.TextContentAddress,
  // List of all authors of the post. Order is undefined (this is a set
  // encoded as a list).
  +authors: $ReadOnlyArray<N.UserlikeAddress>,
|};

type Thread = {|
  // Includes the root post.
  // Ordered chronologically.
  +posts: $ReadOnlyArray<ThreadPost>,
  // Map from raw addresses of userlike kind to an array of all indices
  // `i` such that `posts[i]` references the user (in arbitrary order).
  // The domain is exactly the set of all users who are referenced in
  // the thread at least once.
  +userlikeToPostsReferencingThem: Map<N.RawAddress, $ReadOnlyArray<number>>,
|};

function createThread(root: RV.Issue | RV.Pull): Thread {
  const posts = [];
  const userlikeToPostsReferencingThem = new Map();
  function addPost(x: RV.Issue | RV.Pull | RV.Comment) {
    const address = x.address();
    const authors = Array.from(x.authors()).map((x) => x.address());
    const post = {address, authors};
    posts.push(post);
    for (const referenced of x.references()) {
      if (referenced instanceof RV.Userlike) {
        const referencedAddress = N.toRaw(referenced.address());
        MapUtil.pushValue(
          (((userlikeToPostsReferencingThem: Map<
            N.RawAddress,
            $ReadOnlyArray<number>
            // eslint-disable-next-line flowtype/no-mutable-array
          >): any): Map<N.RawAddress, number[]>),
          referencedAddress,
          posts.length - 1
        );
      }
    }
  }
  addPost(root);
  for (const comment of root.comments()) {
    addPost(comment);
  }
  return {posts, userlikeToPostsReferencingThem};
}

function* referencesFromThread(
  thread: Thread
): Iterator<MentionsAuthorReference> {
  for (const post of thread.posts) {
    for (const author of post.authors) {
      for (const postIndex of thread.userlikeToPostsReferencingThem.get(
        N.toRaw(author)
      ) || []) {
        const thankingAddress = thread.posts[postIndex].address;
        yield {src: thankingAddress, dst: post.address, who: author};
      }
    }
  }
}
