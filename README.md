# [SourceCred](https://sourcecred.io)

[![Build Status](https://circleci.com/gh/sourcecred/sourcecred.svg?style=svg)](https://circleci.com/gh/sourcecred/sourcecred)
[![Discourse topics](https://img.shields.io/discourse/https/discuss.sourcecred.io/topics.svg)](discuss.sourcecred.io)
[![Discord](https://img.shields.io/discord/453243919774253079.svg)](https://discord.gg/tsBTgc9)

SourceCred creates reputation networks for open-source projects.
Any open-source project can create its own _cred_, which is a reputational metric showing how much credit contributors deserve for helping the project.
To compute cred, we organize a project’s contributions into a graph, whose edges connect contributions to each other and to contributors.
We then run PageRank on that graph.

To learn more about SourceCred’s vision and values, please check out [our website] and our [forum].
One good forum post to start with is [A Gentle Introduction to Cred].

For an example of SourceCred in action, you can see SourceCred’s own [prototype cred attribution][prototype].

[our website]: https://sourcecred.io/
[prototype]: https://sourcecred.io/prototype/
[A Gentle Introduction to Cred]: https://discuss.sourcecred.io/t/a-gentle-introduction-to-cred/20

## Current Status

We have a [prototype] that can generate a cred attribution based on GitHub interactions (issues, pull requests, comments, references, etc.).
We’re working on adding more information to the prototype, such as tracking modifications to individual files, source-code analysis, GitHub reactions, and more.

### Running the Prototype

If you’d like to try it out, you can run a local copy of SourceCred as follows.
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
# it can take a few mins to run and will exit when finished
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

will create a graph called `ipfs/meta-ipfs` in the cred explorer, containing the combined contents of the js-ipfs and go-ipfs repositories.

## Early Adopters

We’re looking for projects who want to be early adopters of SourceCred!
If you’re a maintainer of an open-source project and would like to start using SourceCred, please reach out to us on our [Discord] or our [forum].

## Contributing

We’d love to accept your contributions!
You can reach out to us by posting on our [forum], or chatting with us on [Discord].
We'd be happy to help you get started and show you around the codebase.
Please also take a look at our [contributing guide].

If you’re looking for a place to start, we’ve tagged some [good first issues].

[forum]: https://discuss.sourcecred.io
[Discord]: https://discord.gg/tsBTgc9
[contributing guide]: https://github.com/sourcecred/sourcecred/blob/master/CONTRIBUTING.md
[good first issues]: https://github.com/sourcecred/sourcecred/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22

## License

SourceCred is dual-licensed under Apache 2.0 and MIT terms:

  * Apache License, Version 2.0, ([LICENSE-APACHE](LICENSE-APACHE) or <https://www.apache.org/licenses/LICENSE-2.0>)
  * MIT License ([LICENSE-MIT](LICENSE-MIT) or <https://opensource.org/licenses/MIT>)

## Acknowledgements

We’d like to thank [Protocol Labs] for funding and support of SourceCred.
We’d also like to thank the many open-source communities that produced the software that SourceCred is built on top of, such as [Git] and [Node].

[Protocol Labs]: https://protocol.ai
[Git]: https://github.com/git/git
[Node]: https://github.com/nodejs/node
