# CredRank Migration Design Doc

## Created: 2021.01.07

## Last Updated: 2021.01.08

## Authors:

- @decentralion

## Overview

We've finished implementing [CredRank], but we haven't yet migrated SourceCred to use it.
This doc outlines a plan for migrating all of SourceCred to use Cred scores from CredRank,
and to remove [Timeline Cred].

[credrank]: https://discourse.sourcecred.io/t/credrank-scalable-interpretable-flexible-attribution/654
[timeline cred]: https://github.com/sourcecred/sourcecred/pull/1212

## Steps

### Finish Implementing CredGrainView

The `CredGrainView` (see src/core/credGrainView.js) is a class that makes it
convenient to retrieve Cred (and Grain) data about any participant. It will act
as the main data API layer for consumers that need access to Cred data. It's
thus a replacement for the existing `CredView` class at
src/analysis/credView.js.

Currently, CGV exists as an interface, but most of the methods are not
implemented and just throw errors. It needs to be implemented and tested.

### Create a CredRank-compatible Cred Explorer

Presently, the Explorer (src/ui/components/Explorer/Explorer.js) depends on the
`CredView` class, which means it uses TimelineCred scores. We should create a
new overview page that depends on `CredGrainView` instead.

Less ambitiously, we could just port the existing UI over to use `CredView`.
More ambitiously, we could implement the new frontend described in [#2227]. I
think it's probably better to port the existing UI and then treat upgrading to
the new frontend as a separate project, so that we can land this migration more
quickly and easily.

[#2227]: https://github.com/sourcecred/sourcecred/issues/2227

The new Explorer should be wired in as a hidden route, e.g.
`/#/explorer-credrank`. While it's in the hidden state, it will still be
available for debugging/testing purposes, but only for those who know the route
exists, and manually ran the cli `credrank` command first.

When implementing the new UI, we may choose to remove the "expand to see top
contributions" button. In that case, we'll no longer be able to attribute Cred
scores to any concrete contributions in the UI. This is not ideal, however the
existing feature is barely functional due to its lack of context (it doesn't
group contributions by type or time, it only shows the top few individual
contributions, which badly misses the forest for a few individual trees).
We'll want to re-implement a better contribution view as part of the frontend
UI redesign.

### Create a CredRank-compatible `grain` command

Presently, the `grain` command in src/cli/grain.js depends on
`core/ledger/applyDistributions`, which itself depends on `CredView`. Thus,
Grain distributions currently operate on TimelineCred. We should write a new
version of the Grain command (which we can call `grain2` or `grain-credrank`)
which uses the `CredGrainView` instead.

Once the new Grain command is available, it should be wired in to the CLI for
testing, but not actively used until the migration.

### Migrate

Once we have a replacement UI and Grain command that use the `CredGrainView`,
we will be ready to atomically migrate over to the new algorithm. This
migration will have three steps:

1. In src/cli/go.js, replace the `score` command with the `credrank` command in
   the command sequence. Thus, users will automatically compute CredRank scores
   rather than TimelineCred scores.
2. Switch the UI to load the CredRank compatible explorer by default.
3. Rewire the cli so that invoking `sourcecred grain` uses the CredRank
   compatible Grain command.

These three migrations should occur atomically in a single PR, and we should
follow up with a major version release. Let's consider this a breaking change
because the Cred scores will be different after switching algorithms.

### Cleanup

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
