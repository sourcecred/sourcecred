# GitHub Plugin

This is the SourceCred GitHub plugin. It creates a cred graph based on data
from [GitHub].

[GitHub]: https://github.com/

## Nodes

The GitHub plugin creates the following kinds of nodes:

### Repo

A GitHub repository, e.g. [sourcecred/sourcecred]. It will be directly
connected to all of the pulls and issues in the repository. Setting a weight on
the repository will have no effect (i.e. they do not mint cred). This will
change when we switch to [CredRank].

[CredRank]: https://github.com/sourcecred/sourcecred/issues/1686

[sourcecred/sourcecred]: https://github.com/sourcecred/sourcecred

### Issue

A GitHub issue, e.g. [sourcecred/sourcecred#40]. Issues are connected to their
author(s), to entities that they reference, to their comments, and to the
containing GitHub repository. If issues are given a positive weight, then each
issue will mint cred. Note that this could be abused by spammers.

[sourcecred/sourcecred#40]: https://github.com/sourcecred/sourcecred/issues/40

### Pull Request

A GitHub pull request, e.g. [sourcecred/sourcecred#35][pull]. Pulls are
connected to their author(s), to entities they reference, to their comments,
their reviews, to their containing repository, and, (if merged) to the commit
that they merged as. If pulls are given a positive weight, then each pull will
mint cred, regardless of whether or not it merged. Note that this could be
abused by spammers. There's a proposal ([merge-minted cred]) to have pulls mint
cred only when they merge.

[pull]: https://github.com/sourcecred/sourcecred/pull/35
[merge-minted cred]: https://github.com/sourcecred/sourcecred/issues/1682

### Pull Request Review

A review of a GitHub pull request, e.g. [this review]. Reviews are connected to
their author(s), to entities they reference, to their comments, and to the pull
they review. If a positive weight is set on the reviews, then every review will
mint cred; this could be abused by spammers.

[this review]: https://github.com/sourcecred/sourcecred/pull/91#pullrequestreview-105254836

### Comment

A comment on an issue, pull request, or pull request review. Comments are
connected to their author(s), to entities they reference, and to their 'parent'
(the containing issue, pull, or review). If a positive weight is set on
comments, then every comment will mint cred. This can be absued by spammers,
and also may encourage long bikeshedding discussions or flame wars.

### Commit

A commit is a Git commit, as discovered via the GitHub API, e.g. [this commit].
We currently enumerate every commit that is in the history of the `master`
branch. We added commits back when we had a Git plugin; since we've disabled
that plugin, commits are no longer well supported. Commits are connected to
their author(s), to entities they reference, to their parent and child commits,
and to the pull that merged them (if any). If a positive weight is set on
commits, then every commit will mint cred. This is not recommended, since
commits are not well-supported.

Commits will become useful once we re-implement a Git plugin, perhaps with
directory and file tracking. Until then, we may deprecate them since they don't
add much to the plugin at the moment.

[this commit]: https://github.com/sourcecred/sourcecred/commit/94b04541514b991c304616aadfcb417a19871e82

### User

A GitHub user account, e.g. [@decentralion]. User accounts do not mint cred, so
setting a node weight would have no effect. Using the identity plugin, it's
possible to "collapse" user nodes with other identity nodes into a single,
canonical identity. For example, if a contributor had a GitHub user account and
a Discourse account, then the identity plugin can collapse those identities
together.

Users are connected to posts they author, to posts they react to, and to posts that
mention them.

[@decentralion]: https://github.com/decentralion

### Bot

A GitHub user account that has been explicitly marked as a bot, via inclusion
in [bots.js]. This is useful so that we can filter out bot accounts from
receiving grain or showing up in the cred rankings.

Bots have the same connections as users.

[bots.js]: https://github.com/sourcecred/sourcecred/blob/master/src/plugins/github/bots.js


## Edges

### Authors

An authors edge connects an author (i.e. a user or bot) to a post (i.e. a pull,
issue, comment, or review). If the post contains the text "paired with
@other-author", then from SourceCred's perspective, that post will have
multiple authors, all of whom receive an equal share of the cred.

The following are all valid examples of using "paired with":

> paired with @wchargin
>
> paired-with @wchargin
>
> paired with: @wchargin
>
> Paired with @wchargin
>
> Paired With @wchargin
>
> Paired With: @wchargin
>
> Paired-With: @wchargin
>

### References

A references edge connects a post (i.e. a pull, issue, comment, or review) to
another referencable node (i.e. a node that corresponds to a specific url on
GitHub).

If the reference is pointing to a user, we call it a "mention", but
from SourceCred's perspective it's the same kind of edge.

### Reacts

A react edge connects a user (or bot) to a pull, issue, or comment. There are subtypes
of reaction edges corresponding to the type of reaction; currently we support thumbs-up,
heart, and hooray emojis. In the future, we might reify the reactions as nodes, so as to
support reaction-minted cred, in the style of [like-minted cred].

[like-minted cred]: https://discourse.sourcecred.io/t/minting-discourse-cred-on-likes-not-posts/603

### Has Parent

A has-parent edge connects a "child" node to its "parent" node. Here's a table
summarizing these relationships:

| Child | Parent |
| --- | --- |
| Issue | Repository |
| Issue Comment | Issue |
| Pull Request | Repository |
| Pull Comment | Pull Request |
| Pull Request Review | Pull Request |
| Pull Request Review Comment | Pull Request Review |

### Merged As

A merged-as edge connects a pull request to the commit that it merged, assuming
the pull request merged.


## Implementation

The GitHub plugin uses a 'mirror module' to locally store data that we retrieve
from the GitHub API. This allows us to incrementally load data from GitHub,
rather than needing to download the full repository on every load (doing so is
slow and expensive). You can read about the mirror module [here][mirror-impl].

[mirror-impl]: https://github.com/sourcecred/sourcecred/issues/622
