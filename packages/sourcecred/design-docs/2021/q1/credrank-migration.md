# CredRank Migration Design Doc

## Created: 2021.01.07

## Last Updated: 2021.01.25

## Authors:

- @decentralion
- @blueridger

## Overview

We've finished implementing [CredRank], but we haven't yet migrated SourceCred to use it.
This doc outlines a plan for migrating all of SourceCred to use Cred scores from CredRank,
and to remove [Timeline Cred].

[credrank]: https://discourse.sourcecred.io/t/credrank-scalable-interpretable-flexible-attribution/654
[timeline cred]: https://github.com/sourcecred/sourcecred/pull/1212

## Implementation Steps

### 1) Finish Implementing CredGrainView [DONE]

The `CredGrainView` (see src/core/credGrainView.js) is a class that makes it
convenient to retrieve Cred (and Grain) data about any participant. It will act
as the main data API layer for consumers that need access to Cred data. It's
thus a replacement for the existing `CredView` class at
src/analysis/credView.js.

### 2) Create a CredRank-compatible Cred Explorer

Presently, the Explorer (src/ui/components/Explorer/Explorer.js) depends on the
`CredView` class, which means it uses TimelineCred scores. We should create a
new overview page that depends on `CredGrainView` instead.

We could just port the existing UI over to use `CredGrainView` or we could
implement the new ExplorerHome frontend described in [#2227]. Due to the tight coupling between the CredView and the old Explorer and the `CredGrainView`, we
will proceeed with the latter, implementing the new ExplorerHome and deprecating
the old Explorer.

[#2227]: https://github.com/sourcecred/sourcecred/issues/2227

The new Explorer should be wired in as a hidden route, e.g.
`/#/explorer-credrank`. While it's in the hidden state, it will still be
available for debugging/testing purposes, but only for those who know the route
exists, and manually ran the cli `credrank` command first.

By deprecating the old Explorer, we'll no longer be able to attribute Cred
scores to any concrete contributions in the UI, and we'll no longer be able to
use the weight simulator, at least until we build their replacements. This is
not ideal, however the existing contribution list feature is barely functional
due to lack of context (it doesn't group contributions by type or time, it only
shows the top few individual contributions, which badly misses the forest for a
few individual trees), and the weight simulator ui is difficult to interpret.
We'll want to re-implement a better versions of these as part of the frontend
UI redesign.

### 3) Create a CredRank-compatible `grain` command [DONE]

Presently, the `grain` command in src/cli/grain.js depends on
`core/ledger/applyDistributions`, which itself depends on `CredView`. Thus,
Grain distributions currently operate on TimelineCred. We should write a new
version of the Grain command (which we can call `grain2` or `grain-credrank`)
which uses the `CredGrainView` instead.

Once the new Grain command is available, it should be wired in to the CLI for
testing, but not actively used until the migration.

## Rollout Steps

This rollout will have two phases:

### 1) Preview of ExplorerHome [DONE/CANCELED]

This step will give us some more time to figure out how we will replace the
weight simulator and contribution explorer features, and to guage user reaction.
These steps should occur in a single PR and should be followed with a minor
version release.

1. ~~Make the new ExplorerHome visible in the menu to users with a message at
   the top detailing how it uses the new algorithm, is for preview purposes only,
   and does not affect grain payouts yet.~~
2. In src/cli/go.js, update the `go` command to run both `score` and `credrank`

### 2) Full Rollout

These three steps should occur atomically in a single PR, and we should
follow up with a major version release. Let's consider this a breaking change
because the Cred scores will be different after switching algorithms.

1. In src/cli/go.js, remove the `score` command.
2. Switch the UI to load the CredRank compatible explorer by default.
3. Rewire the cli so that invoking `sourcecred grain` uses the CredRank
   compatible Grain command.

### 3) Cleanup

Once the migration is complete, we can cleanup by removing implementation and
dependents of TimelineCred.

Some of the files we should remove include:

- analysis/credData
- analysis/credView
- analysis/pagerank
- analysis/credResult
- analysis/nodeScore
- analysis/timeline/params
- core/algorithm/timelinePagerank
- analysis/pagerankNodeDecomposition
- cli/score
- core/ledger/credAccounts

Some of those files are already vestigial; after completing the switch, all of them should be.
We should also remove any files that depend on those files.
