# [SourceCred](https://sourcecred.io)

[![Build Status](https://circleci.com/gh/sourcecred/sourcecred.svg?style=svg)](https://circleci.com/gh/sourcecred/sourcecred)
[![Discourse topics](https://img.shields.io/discourse/https/discourse.sourcecred.io/topics.svg)](https://discourse.sourcecred.io)
[![Discord](https://img.shields.io/discord/453243919774253079.svg)](https://sourcecred.io/discord)

SourceCred allows communities to assign Cred scores, which measure the value that contributors have brought to the community.
The community can then use the scores to distribute rewards (e.g. project-specific Grain tokens) to their contributors.

Cred is computed by constructing a Cred Graph showing every contribution to a project, and then running a version of the PageRank
algorithm to assign scores to every contribution and contributor.

We currently support loading data from GitHub, Discourse, Discord, and via custom "initiatives".

Please check out [our website] for more information. If you'd like to get involved as a contributor, please drop by [our Discord]
and say "hi"!

[our website]: https://sourcecred.io/
[our Discord]: https://sourcecred.io/discord

## Current Status

SourceCred is still in beta; as such, the interfaces are in flux and the documentation is spotty.
We're working on a polished release which will include more documentation, and more maintainable instances. We expect this to land
by early July.

For now, if you want to use SourceCred, you might start by forking [MetaGame's Cred Instance].

Note that our next release (v0.7.0) will totally revamp how SourceCred instances are setup, and replace the CLI. As such,
expect that migrating from v0.6.0 to v0.7.0 will involve making changes to your configuration.

[MetaGame's Cred Instance]: https://github.com/MetaFam/TheSource

## Development Setup

  - Install [Node] (tested on v12.x.x and v10.x.x).
  - Install [Yarn] (tested on v1.7.0).
  - Create a [GitHub API token]. No special permissions are required.
  - For macOS users: Ensure that your environment provides GNU
    coreutils. [See this comment for details about what, how, and
    why.][macos-gnu]

[Node]: https://nodejs.org/en/
[Yarn]: https://yarnpkg.com/lang/en/
[GitHub API token]: https://github.com/settings/tokens
[macos-gnu]: https://github.com/sourcecred/sourcecred/issues/698#issuecomment-417202213

You'll still need to create a GitHub token to use as an environment variable (shown later). First, run the following commands to clone and build SourceCred:

```Bash
git clone https://github.com/sourcecred/sourcecred.git
cd sourcecred
yarn install
yarn backend
export SOURCECRED_GITHUB_TOKEN=YOUR_GITHUB_TOKEN
```

Once that's been setup, you can start running SourceCred development commands.
In master, the commands are currently in flux. This README will be updated when we have a stable CLI again.


## License

SourceCred is dual-licensed under Apache 2.0 and MIT terms:

  * Apache License, Version 2.0, ([LICENSE-APACHE](LICENSE-APACHE) or <https://www.apache.org/licenses/LICENSE-2.0>)
  * MIT License ([LICENSE-MIT](LICENSE-MIT) or <https://opensource.org/licenses/MIT>)

## Acknowledgements

We’d like to thank [Protocol Labs] for funding and support of SourceCred.

[Protocol Labs]: https://protocol.ai
