# [SourceCred](https://sourcecred.io)

[![Build Status](https://travis-ci.org/sourcecred/sourcecred.svg?branch=master)](https://travis-ci.org/sourcecred/sourcecred)
[![Discord](https://img.shields.io/discord/453243919774253079.svg)](https://discord.gg/tsBTgc9)

SourceCred creates reputation networks for open-source projects.
Using SourceCred, any open-source project can create its own _cred_, which is a reputational metric showing how much credit contributors deserve for helping the project.
To compute cred, we organize a project’s contributions into a graph, whose edges connect contributions to each other and to contributors.
We then run PageRank on that graph.

To learn more about SourceCred’s vision and values, please check out [our website].
For an example of SourceCred in action, you can see SourceCred’s own [prototype cred attribution].

[our website]: https://sourcecred.io/
[prototype cred attribution]: https://sourcecred.io/prototype/

## Current Status

We have a [prototype] which can generate a cred attribution based on GitHub interactions (issues, pull requests, comments, references, etc).
We’re working on adding more information to the prototype, such as tracking modifications to individual files, source-code analysis, GitHub reactions, and more.

[prototype]: https://sourcecred.io/prototype/

### Running the Prototype

If you’d like to try it out, you can run a local copy of SourceCred using the following commands.
You need to have [node] and [yarn] installed first.
This repo is stable and tested on Node version 8.x.x, and Yarn version 1.7.0.
You also need to get a [GitHub API access token].
This token does not need any specific permissions.

[node]: https://nodejs.org/en/
[yarn]: https://yarnpkg.com/lang/en/
[GitHub API access token]: https://github.com/settings/tokens

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

## Early Adopters

We’re looking for projects who want to be early adopters of SourceCred!
If you’re a maintainer of an open-source project and would like to start using SourceCred, please reach out to us on our [Discord].

## Contributing

We’d love to accept your contributions!
Please join our [Discord] to get in touch with us, and check out our [contributing guide] to get started.

If you’re looking for a place to start, we’ve tagged some issues [Contributions Welcome].

[Discord]: https://discord.gg/tsBTgc9
[contributing guide]: https://github.com/sourcecred/sourcecred/blob/master/CONTRIBUTING.md
[Contributions Welcome]: https://github.com/SourceCred/SourceCred/issues?q=is%3Aopen+is%3Aissue+label%3A%22contributions+welcome%22

## Acknowledgements

We’d like to thank [Protocol Labs] for funding and support of SourceCred.
We’d also like to thank the many open-source communities that produced the software that SourceCred is built on top of, such as Git and Node.

[Protocol Labs]: https://protocol.ai
