# [SourceCred](https://sourcecred.io)

[![Build Status](https://circleci.com/gh/sourcecred/sourcecred.svg?style=svg)](https://circleci.com/gh/sourcecred/sourcecred)
[![Discourse topics](https://img.shields.io/discourse/https/discourse.sourcecred.io/topics.svg)](https://discourse.sourcecred.io)
[![Discord](https://img.shields.io/discord/453243919774253079.svg)](https://sourcecred.io/discord)

SourceCred is an open-source tool that enables online communities to create a
community-specific contribution score, called Cred, which measures how much
value every contributor has added to the project. SourceCred then enables the
project to issue tokens, called Grain, to contributors based on their Cred.
Grain is purchased by sponsors of the project, and gives sponsors the ability
to influence Cred scores.

You can read more at [sourcecred.io].

[sourcecred.io]: https://sourcecred.io/

## Plugin Architecture

SourceCred is organized around a plugin architecture, which ensures that it can
track and reward any kind of contribution, so long as you can assign addresses
to contributions, and record how they relate to one another. Currently, we have the following four plugins:

- `sourcecred/github`: Loads GitHub repositories, including issues, pull requests, and reviews
- `sourcecred/discourse`: Loads Discourse forums, including posts, topics, and likes
- `sourcecred/discord`: Loads Discord servers, including messages and reactions
- `sourcecred/initiatives`: Loads manually added contributions. Still in alpha.

Every plugin has a two-part name in the form `$OWNER/$NAME`; for example,
SourceCred's own GitHub plugin is named `sourcecred/github`.

## The Instance System

SourceCred is organized around the concept of "instances". A SourceCred instance
contains all of the configuration and data associataed with Cred and Grain, and
optionally may be set up as a deployable website that displays those scores.
Each instance has the following directory structure:

```
./package.json      # SourceCred version and package scripts
./sourcecred.json   # Lists enabled plugins
./config            # User-edited config files
./data              # Persistent data, e.g. ledger history
./output            # Output data, may be removed/regenerated
./site              # Bundled frontend, if included
./cache             # Temporary data, should not be checked in to git
```

We recommend storing instances in a Git repository. The best way to set up an
instance is by forking [sourcecred/example-instance].

Once your instance is setup, you can update it with the following commands:

- `yarn load`: Regenerate the cache
- `yarn graph`: Recompute graphs from cache
- `yarn score`: Re-run Cred calculations
- `yarn site`: Regenerate the website (potentially upgrading it)
- `yarn go`: Runs `load`, `graph` and `score` in sequence.

If you want to update the data for just one plugin (e.g. `sourcecred/github`), you can use the following
command sequence:

- `yarn load sourcecred/github`
- `yarn graph sourcecred/github`
- `yarn score`

## Contributing Guidelines

If you'd like to contribute to the codebase, we ask you to follow the following
steps:

### 1. Drop by [our Discord].

Come to the #intros channel and introduce yourself. Let us know that you're
interested in helping out. We're friendly and will be happy to help you get
oriented.

### 2. Read our [Contributing Guidelines].

We pride ourself on tidy software engineering; part of how we do that is by
splitting our changes up into many small, atomic commits, each of which are
easy to review. If you'd like to work alongside us, we ask you to adopt our
practices.

### 3. Find an issue to work on.

You can check out the issues marked [contributions welcome], or ask in the
Discord's #programming channel if anyone has something you can contribute to.

[our discord]: https://sourcecred.io/discord
[contributing guidelines]: ./CONTRIBUTING.md
[contributions welcome]: https://github.com/sourcecred/sourcecred/issues?q=is%3Aopen+is%3Aissue+label%3Acontributions-welcome

## Getting Support

If you need help with SourceCred, try asking for help in the #tech-support channel
on our Discord. You can also come to our weekly dev meeting, on Mondays at 12pm PT.
(Check out the [SourceCred calendar].)

[sourcecred calendar]: https://sourcecred.io/calendar

## Development Setup

### Dependencies

- Install [Node] (tested on v12.x.x and v10.x.x).
- Install [Yarn] (tested on v1.7.0).
- For macOS users: Ensure that your environment provides GNU
  coreutils. [See this comment for details about what, how, and
  why.][macos-gnu]

[node]: https://nodejs.org/en/
[yarn]: https://yarnpkg.com/lang/en/
[macos-gnu]: https://github.com/sourcecred/sourcecred/issues/698#issuecomment-417202213

If you want to work on the GitHub plugin, you should
create a [GitHub API token]. No special permissions are required.

[github api token]: https://github.com/settings/tokens

Then, set it in your environment:

```Bash
export SOURCECRED_GITHUB_TOKEN=1234....asdf
```

If you want to work on the Discord plugin, you need a
Discord bot token specific to the bot/server that you are loading.
See instructions [here](https://github.com/sourcecred/example-instance#discord).

### Building SourceCred Locally

First, run the following commands to clone and build SourceCred:

```Bash
git clone https://github.com/sourcecred/sourcecred.git
cd sourcecred
yarn
yarn build
```

### Using A Modified Backend

You'll likely want to test out your modified version of SourceCred on an
instance you're familiar with. A convenient way to do that is to create an
alias for your altered version of SourceCred. Here's an example of how to do
so in a bash shell:

```Bash
SC_REPOSITORY_DIR=`pwd`
alias scdev='node "$SC_REPOSITORY_DIR"/bin/sourcecred.js'
cd $MY_SC_INSTANCE
# Run the `sourcecred go` command, in your instance, using your modified code.
scdev go
```

### Using a Modified Frontend

If you've made changes to the SourceCred frontend, you can preview and test it using our builtin development server:

`yarn start`

By default, the server will run in the tiny example instance located at `./sharness/__snapshots__/example-instance`.
If you'd like to run it in your instance instead, start it via:
`yarn start --instance $PATH_TO_INSTANCE`.

## License

SourceCred is dual-licensed under Apache 2.0 and MIT terms:

- Apache License, Version 2.0, ([LICENSE-APACHE](LICENSE-APACHE) or <https://www.apache.org/licenses/LICENSE-2.0>)
- MIT License ([LICENSE-MIT](LICENSE-MIT) or <https://opensource.org/licenses/MIT>)

## Acknowledgements

We’d like to thank [Protocol Labs] for funding and support of SourceCred.

[protocol labs]: https://protocol.ai
