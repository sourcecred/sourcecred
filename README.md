# [SourceCred](https://sourcecred.io)

[![Build Status](https://circleci.com/gh/sourcecred/sourcecred.svg?style=svg)](https://circleci.com/gh/sourcecred/sourcecred)
[![Discord](https://img.shields.io/discord/453243919774253079.svg)](https://discord.gg/tsBTgc9)

SourceCred is a tool for quantifying the value that people have contributed to
open-source projects. It assigns a quantitative score called 'cred' to every
contribution, based on how that contribution was depended on or referenced by
other work in the project. We believe that creating such a metric is a vital
step towards making open-source sustainable, and to paying open-source
contributors. You can read more about [our mission], or check out the
[SourceCred prototype].

[our mission]: https://github.com/sourcecred/mission/blob/master/overview.md
[SourceCred prototype]: https://sourcecred.io/prototype

This repository contains the SourceCred codebase. For a guided tour of the
codebase, check out our [code walkthrough on YouTube]. You can also find our
project planning and goal setting in the [sourcecred/mission] repository.

[code walkthrough on YouTube]: https://www.youtube.com/watch?v=pt8KawL24wU
[sourcecred/mission]: https://github.com/sourcecred/mission

### Running the Prototype

You can run SourceCred out on any GitHub repository!
To run a local copy, just follow these steps.

First, make sure that you have the following dependencies:

  - Install [Node] (tested on v8.x.x).
  - Install [Yarn] (tested on v1.7.0).
  - Create a [GitHub API token]. No special permissions are required.
  - For macOS users: Ensure that your environment provides GNU
    coreutils. [See this comment for details about what, how, and
    why.][macos-gnu]

[Node]: https://nodejs.org/en/
[Yarn]: https://yarnpkg.com/lang/en/
[GitHub API token]: https://github.com/settings/tokens

[macos-gnu]: https://github.com/sourcecred/sourcecred/issues/698#issuecomment-417202213

Then, run the following commands to clone and build SourceCred:

```
git clone https://github.com/sourcecred/sourcecred.git
cd sourcecred
yarn install
yarn backend
export SOURCECRED_GITHUB_TOKEN=YOUR_GITHUB_TOKEN
node bin/sourcecred.js load REPO_OWNER/REPO_NAME
# this loads sourcecred data for a particular repository
yarn start
# then navigate to localhost:8080 in your browser
```

For example, if you wanted to look at cred for [ipfs/js-ipfs], you could run:

```
$ export SOURCECRED_GITHUB_TOKEN=0000000000000000000000000000000000000000
$ node bin/sourcecred.js load ipfs/js-ipfs
```

replacing the big string of zeros with your actual token.

[ipfs/js-ipfs]: https://github.com/ipfs/js-ipfs

You can also combine data from multiple repositories into a single graph.
To do so, pass multiple repositories to the `load` command, and specify an “output name” for the repository.
For instance, the invocation

```
node bin/sourcecred.js load ipfs/js-ipfs ipfs/go-ipfs --output ipfs/meta-ipfs
```

will create a graph called `ipfs/meta-ipfs` in the cred explorer, containing
the combined contents of the js-ipfs and go-ipfs repositories.

## Early Adopters

We’re looking for projects who want to be early adopters of SourceCred!

If you’re a maintainer of an open-source project and would like to start using
SourceCred, please reach out to us on our [Discord].

## Contributing

We’d love to accept your contributions!
You can reach out to us by visting our [Discord].
We'd be happy to help you get started and show you around the codebase.
Please also take a look at our [contributing guide], and our [guided tour] of
the codebase.

If you’re looking for a place to start, we’ve tagged some issues [Contributions Welcome].

[Discord]: https://discord.gg/tsBTgc9
[contributing guide]: https://github.com/sourcecred/sourcecred/blob/master/CONTRIBUTING.md
[guided tour]: https://www.youtube.com/watch?v=pt8KawL24wU
[Contributions Welcome]: https://github.com/SourceCred/SourceCred/issues?q=is%3Aopen+is%3Aissue+label%3A%22contributions+welcome%22

## License

SourceCred is dual-licensed under Apache 2.0 and MIT terms:

  * Apache License, Version 2.0, ([LICENSE-APACHE](LICENSE-APACHE) or <https://www.apache.org/licenses/LICENSE-2.0>)
  * MIT License ([LICENSE-MIT](LICENSE-MIT) or <https://opensource.org/licenses/MIT>)

## Acknowledgements

We’d like to thank [Protocol Labs] for funding and support of SourceCred.
We’d also like to thank the many open-source communities that produced the software that SourceCred is built on top of, such as Git and Node.

[Protocol Labs]: https://protocol.ai
