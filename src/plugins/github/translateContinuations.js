// @flow
// Temporary module to translate GraphQL results from the old format
// with manually resolved continuations to the format emitted by the
// Mirror module. See issue #923 for context.

import type {
  AuthorJSON,
  BotJSON,
  CommentJSON,
  CommitJSON,
  GitObjectJSON,
  GithubResponseJSON,
  IssueJSON,
  OrganizationJSON,
  PullJSON,
  ReactionJSON,
  RefJSON,
  RepositoryJSON,
  ReviewCommentJSON,
  ReviewJSON,
  UserJSON,
} from "./graphql";
import type {
  Actor,
  Blob,
  Bot,
  Commit,
  GitObject,
  GitObjectID,
  Issue,
  IssueComment,
  Organization,
  PullRequest,
  PullRequestReview,
  PullRequestReviewComment,
  Reaction,
  Ref,
  Repository,
  RepositoryOwner,
  Tag,
  Tree,
  User,
} from "./graphqlTypes";

export type Warning =
  // We've never seen it happen, and don't know how it could. But the
  // GitHub schema says that it can. This warning is more of a
  // diagnostic to the SourceCred maintainers (if it comes up on a real
  // repository, we can learn something!) than an indication that
  // something has gone wrong.
  | {|+type: "NON_COMMIT_REF_TARGET", +target: GitObjectJSON|}
  // This can happen if a commit has a parent that we did not fetch. We
  // only fetch commits that are Git-reachable from HEAD or are the direct
  // merge commit of a pull request. We may therefore omit commits that
  // disappeared from master after a force-push, or were an ancestor of a
  // pull request that was merged into a branch other than master. See
  // issue #923 for more context. If this is omitted, we will simply
  // omit the offending parent commit.
  | {|+type: "UNKNOWN_PARENT_OID", +child: GitObjectID, +parent: GitObjectID|};

export default function translate(
  json: GithubResponseJSON
): {|
  +result: Repository,
  +warnings: $ReadOnlyArray<Warning>,
|} {
  const repositoryJson = json.repository;
  const warnings: Array<Warning> = [];

  // Most of the work that this function does is exploding connections
  // into lists of nodes. But commits require some special attention,
  // because we have to resolve parent OIDs to actual parent commits.
  // This means that it is most convenient to start by discovering all
  // commits in the data.
  const commits: Map<
    GitObjectID,
    {|
      ...Commit,
      parents: Array<null | Commit>, // mutable: we build this incrementally
    |}
  > = new Map();

  // First, create all the commit objects, initializing them with empty
  // parent arrays. We put these temporarily into a map keyed by OID for
  // deduplication: a commit may appear both in the linearized history
  // from HEAD and also as the merge commit of a pull request, and we
  // want to process it just once.
  const commitJsons: $ReadOnlyArray<CommitJSON> = Array.from(
    new Map(
      Array.from(
        (function*() {
          if (repositoryJson.defaultBranchRef) {
            const target = repositoryJson.defaultBranchRef.target;
            switch (target.__typename) {
              case "Commit":
                yield* target.history.nodes;
                break;
              case "Tree":
              case "Blob":
              case "Tag":
                warnings.push({type: "NON_COMMIT_REF_TARGET", target});
                break;
              // istanbul ignore next: unreachable per Flow
              default:
                throw new Error((target.type: empty));
            }
          }
          for (const pull of repositoryJson.pulls.nodes) {
            if (pull.mergeCommit) {
              yield pull.mergeCommit;
            }
          }
        })()
      ).map((json) => [json.oid, json])
    ).values()
  );
  for (const commitJson of commitJsons) {
    const commit = {
      __typename: "Commit",
      author: {...commitJson.author},
      id: commitJson.id,
      message: commitJson.message,
      oid: commitJson.oid,
      parents: [],
      url: commitJson.url,
    };
    commits.set(commit.oid, commit);
  }

  // Then, once all the objects have been created, we can set up the
  // parents.
  for (const commitJson of commitJsons) {
    const commit = commits.get(commitJson.oid);
    // istanbul ignore next: should not be possible
    if (commit == null) {
      throw new Error(
        "invariant violation: commit came out of nowhere: " + commitJson.oid
      );
    }
    for (const {oid: parentOid} of commitJson.parents.nodes) {
      const parentCommit = commits.get(parentOid);
      if (parentCommit == null) {
        warnings.push({
          type: "UNKNOWN_PARENT_OID",
          child: commitJson.oid,
          parent: parentOid,
        });
      } else {
        commit.parents.push(parentCommit);
      }
    }
  }

  // The rest is mostly mechanical. The pattern is: we pull off and
  // recursively translate the non-primitive fields of each object, and
  // then add a typename and put back the primitives. For union types,
  // we switch on the __typename and dispatch to the appropriate object
  // translators.

  function translateRepository(json: RepositoryJSON): Repository {
    const {defaultBranchRef, issues, owner, pulls, ...rest} = json;
    return {
      __typename: "Repository",
      defaultBranchRef:
        defaultBranchRef == null
          ? null
          : translateDefaultBranchRef(defaultBranchRef),
      issues: issues.nodes.map(translateIssue),
      owner: translateRepositoryOwner(owner),
      pullRequests: pulls.nodes.map(translatePullRequest),
      ...rest,
    };
  }

  function translateDefaultBranchRef(json: RefJSON): Ref {
    const {target, ...rest} = json;
    return {
      __typename: "Ref",
      target: translateDefaultBranchRefTarget(target),
      ...rest,
    };
  }

  // This one is a bit wonky, because our `GitObjectJSON` type is not a
  // good representation of the GitHub schema. In particular, a
  // `GitObjectJSON` can represent a commit, but in a different form
  // than our `CommitJSON`! This function _only_ applies to
  // `GitObjectJSON`s that we fetched as the `target` of the
  // `defaultBranchRef` of a repository. But these are the only
  // `GitObjectJSON`s that we fetch, so it's okay.
  function translateDefaultBranchRefTarget(json: GitObjectJSON): GitObject {
    switch (json.__typename) {
      case "Commit":
        // The default branch ref is `null` if there are no commits, so
        // the history must include at least one commit (the HEAD
        // commit).
        return lookUpCommit(json.history.nodes[0].oid);
      case "Blob":
        return ({...json}: Blob);
      case "Tag":
        return ({...json}: Tag);
      case "Tree":
        return ({...json}: Tree);
      // istanbul ignore next: unreachable per Flow
      default:
        throw new Error((json.__typename: empty));
    }
  }

  function lookUpCommit(oid: GitObjectID): Commit {
    const commit = commits.get(oid);
    // istanbul ignore if: unreachable: we explored all commits in
    // the response, including this one.
    if (commit == null) {
      throw new Error("invariant violation: unknown commit: " + oid);
    }
    return commit;
  }

  function translateCommit(json: CommitJSON): Commit {
    return lookUpCommit(json.oid);
  }

  function translateIssue(json: IssueJSON): Issue {
    const {author, comments, reactions, ...rest} = json;
    return {
      __typename: "Issue",
      author: author == null ? null : translateActor(author),
      comments: comments.nodes.map(translateIssueComment),
      reactions: reactions.nodes.map(translateReaction),
      ...rest,
    };
  }

  function translateIssueComment(json: CommentJSON): IssueComment {
    const {author, reactions, ...rest} = json;
    return {
      __typename: "IssueComment",
      author: author == null ? null : translateActor(author),
      reactions: reactions.nodes.map(translateReaction),
      ...rest,
    };
  }

  function translateReaction(json: ReactionJSON): Reaction {
    const {user, ...rest} = json;
    return {
      __typename: "Reaction",
      user: user == null ? null : translateUser(user),
      ...rest,
    };
  }

  function translateRepositoryOwner(
    json: UserJSON | OrganizationJSON
  ): RepositoryOwner {
    switch (json.__typename) {
      case "User":
        return translateUser(json);
      case "Organization":
        return translateOrganization(json);
      // istanbul ignore next: unreachable per Flow
      default:
        throw new Error((json.__typename: empty));
    }
  }

  function translateActor(json: AuthorJSON): Actor {
    switch (json.__typename) {
      case "User":
        return translateUser(json);
      case "Organization":
        return translateOrganization(json);
      case "Bot":
        return translateBot(json);
      // istanbul ignore next: unreachable per Flow
      default:
        throw new Error((json.__typename: empty));
    }
  }

  function translateUser(json: UserJSON): User {
    return {...json};
  }

  function translateOrganization(json: OrganizationJSON): Organization {
    return {...json};
  }

  function translateBot(json: BotJSON): Bot {
    return {...json};
  }

  function translatePullRequest(json: PullJSON): PullRequest {
    const {author, comments, mergeCommit, reactions, reviews, ...rest} = json;
    return {
      __typename: "PullRequest",
      author: author == null ? null : translateActor(author),
      comments: comments.nodes.map(translateIssueComment),
      mergeCommit: mergeCommit == null ? null : translateCommit(mergeCommit),
      reactions: reactions.nodes.map(translateReaction),
      reviews: reviews.nodes.map(translatePullRequestReview),
      ...rest,
    };
  }

  function translatePullRequestReview(json: ReviewJSON): PullRequestReview {
    const {author, comments, ...rest} = json;
    return {
      __typename: "PullRequestReview",
      author: author == null ? null : translateActor(author),
      comments: comments.nodes.map(translatePullRequestReviewComment),
      ...rest,
    };
  }

  function translatePullRequestReviewComment(
    json: ReviewCommentJSON
  ): PullRequestReviewComment {
    const {author, reactions, ...rest} = json;
    return {
      __typename: "PullRequestReviewComment",
      author: author == null ? null : translateActor(author),
      reactions: reactions.nodes.map(translateReaction),
      ...rest,
    };
  }

  const result = translateRepository(repositoryJson);
  return {result, warnings};
}
