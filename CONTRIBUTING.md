# Contributing

Contributions are appreciated! If you’d like to contribute, please help
us out by reading this short document.

## Before writing code

If you’re interested in adding a new feature, consider opening an issue
suggesting it. Then, we can discuss the feature to make sure that
everyone is on board.

If you’re interested in helping but don’t know where to start, consider
looking at open issues. [Issues marked **good first issue**][gfi]
may be especially accessible to newcomers.

[gfi]: https://github.com/sourcecred/sourcecred/issues?q=is%3Aissue+label%3A"good+first+issue"

If you find an issue that you’re interested in addressing, consider
adding a comment to that effect. This way, we can let you know if the
issue has gone stale before you put too much work into it, and other
contributors can know to focus on other issues.

## While writing code

### Semantically atomic commits

> for each desired change, make the change easy (warning: this may be
> hard), then make the easy change
>
> [—Kent Beck][kbeck-tweet]

[kbeck-tweet]: https://twitter.com/KentBeck/status/250733358307500032

Please factor your work into semantically atomic commits. Each commit
should represent a single semantic change, and the code included in the
commit should be the minimal amount of code required to implement, test,
and document that change.

For instance, perhaps you want to change the behavior of a component,
and along the way you find that it is useful to refactor a helper
function. In that case, you can create two commits: one to effect the
refactoring, and one to implement the change that has been made easy by
the refactoring.

This doesn’t mean that you have to physically write the code in this
order! The Git commit graph is malleable: you can write the code all at
once and commit it piecewise with `git add -p`; you can split and join
commits with interactive rebases; etc. What matters is the final
sequence of commits, not how you got there.

At the end of the day, you may find that you have a somewhat long
sequence of somewhat short changes. This is great. The goal is for a
reviewer to be able to say, “yep, this commit is obviously correct” as
many times in a row as are necessary for a full feature to be developed.

<details>
<summary>Why create small commits?</summary>

Writing small commits can help improve the design of your code. It is
common to realize an elegant way to split apart some functionality out
of a desire to split a commit into smaller, more localized pieces.

It is easier to review a commit that does one thing than a commit that
does many things. Not only will changes to the code be more localized,
but it will be easier for the reviewer to keep the whole context in
their mind.

Investigating and fixing bugs is much easier when commits are small.
There are more commits to look through, but an 8-fold increase in the
number of commits only entails 3 additional steps of bisection, which is
not a big deal. On the other hand, once the offending commit is
identified, the cause is more apparent if the commit is tiny than if it
is large.

</details>

### Checks

Each commit will need to pass all tests. Run `yarn test` or `npm test`
to run them all. This will run:

- **Flow** (`yarn flow`). Your code must type-check with no errors or
  warnings. Using `any`-casts is permitted, but should be truly a last
  resort. You should put significant effort into avoiding every
  `any`-cast.

- **Unit tests** (`yarn unit`). You can also run `yarn unit --watch`
  to automatically re-run tests when you change a relevant file.

- **Sharness** (`yarn sharness`). This runs shell-based tests, located
  in the `sharness/` directory.

- **Prettier** (`check-pretty`). You can simply run `yarn prettify` to
  reformat all files. It can be convenient to set up your editor to
  run `yarn prettier --write CURRENT_FILENAME` whenever you save a
  file.

- **Lint** (`yarn lint`). You’ll have to fix lint errors manually.
  These are almost always unused imports or unused variables, and
  sometimes catch logic errors before unit tests do. Feel free to
  disable spurious lint errors on a per-line basis by inserting a
  preceding line with `// eslint-disable-next-line LINT_RULE_NAME`.

- **Backend applications build** (`yarn build:backend`). This makes
  sure that the CLI still builds.

- **Check for `@flow` pragmas** (`./scripts/ensure-flow.sh`). This
  makes sure that every file includes a `// @flow` directive or an
  explicit `// @no-flow` directive. The former is required for Flow to
  consider a file. The latter has no effect, but we assert its
  existence to make sure that we don’t simply forget to mark a file
  for Flow. If this is failing, you probably added a new file and just
  need to add `// @flow` to the top. Exceptional circumstances
  excepted, all new files should have `// @flow`.

- **Check for stopships.** The sequence `STOPSHIP` (in any case) is
  not allowed to appear in the codebase, except in Markdown files. You
  can take advantage of this to insert a quick hack and make sure that
  you remember to remove it later.

This is the same set of tests that is run on our CI system, CircleCI.

### Updating CHANGELOG.md

If your patch makes a change that would be visible or interesting to a
user of SourceCred—for example, fixing a bug—please add a description of
the change under the `[Unreleased]` heading of `CHANGELOG.md`. Your new
change should be the first entry in the section. The format of your
entry should be: `<description of change> (#<PR number>)`.

## When writing commit messages

### Summary of changes

Include a brief yet descriptive **summary** as the first line of the
message. The summary should be at most 50 characters, should be written
in the imperative mood, and should not include trailing punctuation. The
summary should either be in sentence case (i.e., the first letter of the
first word capitalized), or of the form “area: change description”. For
instance, all of the following are examples of good summaries:

- Improve error messages when GitHub query fails
- Make deploy script wait for valid response
- Upgrade Flow to v0.76.0
- new-webpack: replace old scripts in `package.json`
- fetchGithubRepo: remove vestigial data field

If you find that you can’t concisely explain your change in 50
characters, move non-essential information into the body of the commit
message. If it’s still difficult, you may be trying to change too much
at once!

<details>
<summary>Why include a summary?</summary>

The 50-character summary is critical because this is what Git
expects. Git often assumes that the first line of a commit contains a
concise description, and so workflows like interactive rebases surface
this information. The particular style of the summary is chosen to be
consistent with those commits emitted by Git itself: commands like
`git-revert` and `git-merge` are of this form, so it’s a good standard
to pick.

</details>

### Description

After the initial line, include a **description** of the change. Why is
the change important? Did you consider and reject alternate formulations
of the same idea? Are there relevant issues or discussions elsewhere? If
any of these questions provides valuable information, answer it.
Otherwise, feel free to leave it out—some changes really are
self-documenting, and there’s no need to add a vacuous description.

<details>
<summary>Why include a description?</summary>

A commit describes a _change_ from one state of the codebase to the
next. If your patch is good, the final state of the code will be clear
to anyone reading it. But this isn’t always sufficient to explain why
the change was necessary. Documenting the motivation, alternate
formulations, etc. is helpful both in the present (for reviewers) and in
the future (for people using `git-blame` to try to understand how a
piece of code came to be).

</details>

### Test plan

After the description, include a **test plan**. Describe what someone
should do to verify that your changes are correct. This can include
automated tests, manual tests, or tests of the form “verify that when
you change the code in this way, you see this effect.” Feel free to
include shell commands and expected outputs if helpful.

Sometimes, the test plan may appear trivial. It may be the case that you
only ran the standard unit tests, or that you didn’t feel that any
testing at all was necessary. In these cases, you should still include
the test plan: this signals to observers that the trivial steps are
indeed sufficient.

<details>
<summary>Why include a test plan?</summary>

The value of a test plan is many-fold. Simply writing the test plan can
force you to consider cases that you hadn’t before, in turn helping you
discover bugs or think of alternate implementations. Even if the test
plan is as simple as “standard unit tests suffice”, this indicates to
observers that no additional testing is required. The test plan is
useful for reviewers, and for anyone bisecting through the history or
trying to learn more about the development or intention of a commit.

</details>

### Wrapping

Wrap all parts of the commit message so that no line has more than **72
characters**.

<details>
<summary>Why wrap at 72 characters?</summary>

This leaves room for four spaces of padding on either side while still
fitting in an 80-character terminal. Programs like `git-log` expect that
this amount of padding exists.

(Yes, people really still use 80-character terminals. When each of your
terminals has bounded width, you can display more of them on a screen!)

</details>

### Example

Here is an example of a helpful commit message. [The commit in
question][example-commit] doesn’t change very many lines of code, but
the commit message explains the context behind the commit, links to
relevant issues, thanks people who contributed to the commit, and
describes a manual test plan. Someone reading this commit for the first
time will have a much better understanding of the change by reading this
commit message:

```
Improve error messages when GitHub query fails

Currently, the GitHub graph fetcher will characteristically fail if:
1. it times out GitHub's server
2. it triggers the semidocumented abuse detection mechanism

In case 1, an intelligible error is posted to the console. In case 2, it
produces an unintelligible TypeError, because the response is not a
valid GraphQL response (the error field is not populated; it has a
custom message instead).

As of this commit, we gracefully catch both cases, and print a message
to console directing the user to #350, which has context on GitHub query
failures. This new catch works because in case 2, the data field is
empty, so we now properly recognize `x.data === undefined` as an error
case.

Thanks to @wchargin for the investigatory work behind this commit.

Fixes #223.

Test plan:
We don't have unit tests that cover this case, but I did manually test
it by asking GitHub to fetch `ipfs/go-ipfs`, which consistently fails.
I also tested it by using an invalid length-40 GitHub API token.
```

[example-commit]: https://github.com/sourcecred/sourcecred/commit/b61b8fbdb88a64192ca837550b7a53e6c27a90e0

## When submitting a pull request

Please create pull requests against `master` by default.

If your pull request includes multiple commits, please include a
high-level summary and test plan in the pull request body. Otherwise,
the text of your pull request can simply be the body of the unique
commit message.

Please be aware that, as a rule, we do not create merge commits. If you
have a stack of commits, we can either rebase the stack onto master
(preserving the history) or squash the stack into a single commit.

### Running full tests on CI

As soon as you open your pull request, our CI will start running the
basic test suite (`yarn test --ci`). It will also try to run the full
test suite (`yarn test --ci --full`), but this will fail for PRs created
from forks because it depends on credentials that aren’t exposed to
untrusted PRs by default. This is expected—don’t worry!

Once a core team member sanity-checks your PR to make sure that it’s not
accidentally leaking credentials into logs, they can “bless” your commit
by pushing it to any branch on the main SourceCred repository. This will
restart the full test suite, which will now actually run. Once your
tests pass and the PR is approved, we’ll delete the extra branch.

## Merging your Pull Request

If you're a new contributor, one of the repository maintainers will merge your pull requests
for you, once they've been approved by the team. After you've become a seasoned contributor, you can
ask a maintainer to give you merge permissions.

Once you have merge permissions, the expectations are:

1. Only merge your own pull requests (until you become a maintainer yourself)
2. Ensure that we have a clean Git history. Every commit in our history should
   leave the codebase in a functional state, with all tests passing. (This
   ensures that we can use `git bisect` to hunt down regressions.)

In general, you can ensure that the git history is clean by only using "squash
and merge", and only merging pull requests that pass CI. "Rebase and merge"
should be used only in special circumstances.

## Our Code Review Practices

### Nit-and-approve

When reviewing, distinguish between substantive comments and "nits". "Nits" are
suggested changes that only superficially affect the code, e.g. asking for a
variable name to be tweaked, replacing a for loop with a map, et cetera. If you
think the code you're reviewing is good except for some nits, we encourage you
to approve it (nit-and-approve), trusting that the pull request author will
address your nits before merging.

### When to request changes

When reviewing and suggesting changes, we usually use the "comment"
functionality in GitHub reviews, rather than "requesting changes". Since
requesting changes blocks the PR and sets a visually red state on it, we think
it's too aggressive / extreme for most proposed changes.

We formally request changes when there actually _is_ a reason to hard-block the
PR until issues are addressed. Examples include PRs that introduce security
vulnerabilites, or that break fundamental assumptions in the codebase.


