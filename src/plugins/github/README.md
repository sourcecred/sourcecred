# GitHub Plugin

This is the SourceCred GitHub plugin. It creates a cred graph based on data
from [GitHub].

The goal of the GitHub plugin is to assign cred to contributors participating
on GitHub, for example by writing or reviewing code, filing and triaging bug
reports, maintaining the build, and cutting new releases.

The plugin does this by downloading extensive data on the repository history
from GitHub, and using it to create a contribution graph. You can read below to
see the kinds of nodes and edges in that graph. The data is temporarily cached
locally, but the source of truth for the GitHub plugin is always GitHub's live
servers. That means that if content is deleted on GitHub, it will also
disappear from the GitHub plugin (after a cache refresh).

## Status and Caveats

The GitHub plugin is still in beta. It tends to assign reasonable cred scores
to contributors. However, it has difficulty assigning cred scores to pull
requests. This is because, in general, the plugin mints cred based on raw
activity. Depending on weight choices, every pull will mint a fixed amount of
cred, likewise for every comment, issue, review, and so forth.

This is problematic because, to put it simply, not all activity is equally
valuable. Minting cred directly on raw activity encourages contributors to
focus on quantity over quality. As an example, a poorly thought out pull
request (which requires lots of review and feedback to fix) will generate more
cred than a clean, elegant pull request (which merges with a minimum of fuss).

We intend to improve the cred robustness of the GitHub plugin by
adding better heuristics for assigning cred, e.g.:

- Minting cred when PRs are merged, rather than when they are created.
- Allowing custom labels that influence the cred minted to pulls.
- Modifying cred minting based on metrics like the size of the pull request.

We also intend to move cred minting away from raw activity and towards
actions that require review, e.g.:

- Minting cred when a pull request merges.
- Minting cred when a release is created.
- Minting cred when a feature is added (via the Initiatives Plugin).

[github]: https://github.com/

## Nodes

The GitHub plugin creates the following kinds of nodes:

### Repo

- **Repo**:

A GitHub repository, e.g. [sourcecred/sourcecred]. The repo node will be
directly connected to all of the PRs and issues in the repository. The repo
node has no timestamp, so setting a weight on the repository will have no
effect (i.e. repos do not mint cred). This may change when we switch to
[CredRank].

[credrank]: https://github.com/sourcecred/sourcecred/issues/1686
[sourcecred/sourcecred]: https://github.com/sourcecred/sourcecred

- **Issue**:

A GitHub issue, e.g. [sourcecred/sourcecred#40]. Issues are connected to their
author(s), to entities that they reference, to their comments, and to the
containing GitHub repository.

[sourcecred/sourcecred#40]: https://github.com/sourcecred/sourcecred/issues/40

- **Pull Request**:

A GitHub pull request, e.g. [sourcecred/sourcecred#35][pull]. Pulls are
connected to their author(s), to entities they reference, to their comments,
their reviews, to their containing repository, and, (if merged) to the commit
that they created when merged.

[pull]: https://github.com/sourcecred/sourcecred/pull/35

- **Pull Request Review**:

A review of a GitHub pull request, e.g. [this review]. Reviews are connected to
their author(s), to entities they reference, to their comments, and to the pull
they review. Note that review assignments are not currently tracked.

[this review]: https://github.com/sourcecred/sourcecred/pull/91#pullrequestreview-105254836

- **Comment**:

A comment on an issue, pull request, or pull request review. Comments are
connected to their author(s), to entities they reference, and to their 'parent'
(the containing issue, pull, or review).

- **Commit**:

A commit is a Git commit, as discovered via the GitHub API, e.g. [this commit].
We currently enumerate every commit that is in the history of the `master`
branch.

Commits currently do not add much value in the cred graph, because they are not
meaningfully connected to the contents of the commits. For example, it would be
great if a code module flowed cred to commits that implemented or modified the
module, which could then flow to the pull requests that added those commits. In
this case, we would be making meaningful use of having commits in the graph.

However, as of March 2020, we do not track cred at the module, file, or
directory level. Because of this, commits do not add much value beyond their
connections to pull requests (which are already in the graph).

[this commit]: https://github.com/sourcecred/sourcecred/commit/94b04541514b991c304616aadfcb417a19871e82

- **User**:

A GitHub user account, e.g. [@decentralion]. User accounts do not mint cred, so
setting a node weight would have no effect. Using the identity plugin, it's
possible to "collapse" user nodes with other identity nodes into a single,
canonical identity. For example, if a contributor had a GitHub user account and
a Discourse account, then the identity plugin can collapse those identities
together.

Users are connected to posts they author, to posts they react to, and to posts that
mention them.

[@decentralion]: https://github.com/decentralion

- **Bot**:

A GitHub user account that has been explicitly marked as a bot, via inclusion
in [bots.js]. This is useful so that we can filter out bot accounts from
receiving grain or showing up in the cred rankings.

Bots have the same connections as users.

[bots.js]: https://github.com/sourcecred/sourcecred/blob/master/src/plugins/github/bots.js

## Edges

- **Authors**:

An "authors" edge connects an author (i.e. a user or bot) to a post (i.e. a
pull, issue, comment, or review). If the post contains the text "paired with
@other-author", then from SourceCred's perspective, that post will have
multiple authors, all of whom receive an equal share of the cred.

The "paired with" flag is case-insensitive, and may optionally include a
hyphen or colon, so that the below are all valid "paired with" designators:

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

- **References**:

A references edge connects a post (i.e. a pull, issue, comment, or review) to
another referencable node (i.e. a node that corresponds to a specific url on
GitHub).

If the reference is pointing to a user, we call it a "mention", but
from SourceCred's perspective it's the same kind of edge.

- **Reacts**:

A react edge connects a user (or bot) to a pull, issue, or comment. There are
subtypes of reaction edges corresponding to the type of reaction; currently we
support thumbs-up, heart, and hooray emojis. In the future, we might reify the
reactions as nodes, so as to support reaction-minted cred, in the style of
[like-minted cred].

[like-minted cred]: https://discourse.sourcecred.io/t/minting-discourse-cred-on-likes-not-posts/603

- **Has Parent**:

A has-parent edge connects a "child" node to its "parent" node. Here's a table
summarizing these relationships:

| Child                       | Parent              |
| --------------------------- | ------------------- |
| Issue                       | Repository          |
| Issue Comment               | Issue               |
| Pull Request                | Repository          |
| Pull Comment                | Pull Request        |
| Pull Request Review         | Pull Request        |
| Pull Request Review Comment | Pull Request Review |

- **Merged As**:

A merged-as edge connects a pull request to the commit that it merged, assuming
the pull request was merged.

## Implementation

The GitHub plugin uses a 'mirror module' to locally store data that we retrieve
from the GitHub API. This allows us to incrementally load data from GitHub,
rather than needing to download the full repository on every load (doing so is
slow and expensive). You can read about the mirror module [here][mirror-impl].

[mirror-impl]: https://github.com/sourcecred/sourcecred/issues/622
