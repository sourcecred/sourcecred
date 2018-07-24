## SourceCred

[![Build Status](https://travis-ci.org/sourcecred/sourcecred.svg?branch=master)](https://travis-ci.org/sourcecred/sourcecred)
[![Discord](https://img.shields.io/discord/453243919774253079.svg)](https://discord.gg/tsBTgc9)

### Vision

Open source software is amazing, and so are its creators and maintainers.  How
amazing? It's difficult to tell, since we don't have good tools for recognizing
those people. Many amazing open-source contributors labor in the shadows, going
unappreciated for the work they do.

SourceCred will empower projects to track contributions and create cred, a
reputational measure of how valuable each contribution was to the project.
Algorithmically, contributions will be organized into a [graph], with edges
representing connections between contributions. Then, a configurable [PageRank]
algorithm will distill that graph into a cred attribution.

[graph]: https://en.wikipedia.org/wiki/Graph_(discrete_mathematics)
[PageRank]: https://en.wikipedia.org/wiki/PageRank

SourceCred is dogfooding itself. People who contributes to SourceCred—by
writing bug reports, participating in design discussions, or writing pull
requests—will receive cred in SourceCred.

### Design Goals

SourceCred development is organized around the following high-level goals.

- *Transparent*

It should be easy to see why cred is attributed as it is, and link a person's
cred directly to contributions they've made.

- *Community Controlled*

Each community has the final say on what that community's cred is. We don't
expect an algorithm to know what's best, so we'll empower communities to use
algorithmic results as a starting point, and improve results with their
knowledge.

- *Decentralized*

Individual projects and communities will control their own SourceCred
instances, and own their own data. The SourceCred creators won't have the power
to control or modify other projects' cred.

- *Forkable*

Forking is important to open source, and gives people the freedom to vote with
their feet. SourceCred will support forking, and forks will be able to modify
their cred independently of the original.

- *Flexible & Extensible*

SourceCred is focused on open-source projects for now, but we think it can be a
general system for building reputation networks. We're organizing around very
flexible core abstractions, and a plugin architecture for specific domains.

### Current Status

As of July 2018, it's still early days for SourceCred! So far, we've set the
following foundations:

- the [graph class] is the heart of SourceCred, and we've spent a lot of time
polishing those APIs 🙂
- the [GitHub plugin] downloads data from GitHub and imports it into a graph
- the [Git plugin] clones a Git repository and imports it into a graph
- our [PageRank implementation] does cred attribution on the graph
- the [cred explorer] makes the PageRank results transparent

[graph class]: https://github.com/sourcecred/sourcecred/blob/master/src/core/graph.js
[Git plugin]: https://github.com/sourcecred/sourcecred/tree/master/src/plugins/git
[GitHub plugin]: https://github.com/sourcecred/sourcecred/tree/master/src/plugins/github
[PageRank implementation]: https://github.com/sourcecred/sourcecred/blob/master/src/core/attribution/pagerank.js
[cred explorer]: https://github.com/sourcecred/sourcecred/tree/master/src/app/credExplorer

The PageRank results aren't very good yet - we need to add more configurability
to get higher quality results. We're working out improvements [in this issue].

[in this issue]: https://github.com/sourcecred/sourcecred/issues/476

### Roadmap

The team is focused right now on building an end-to-end beta that can import
GitHub repositories and produce a reasonable and configurable cred attribution.
We hope to have the beta ready by November 2018.

### Running the Prototype

If you'd like to try it out, you can run a local copy of SourceCred using the
following commands. You need to have [node] and [yarn] installed first. This repo
 is stable and tested on Node version 8.x.x, and Yarn version 1.7.0.
You also need to get a [GitHub API access token]. This token does not need any
specific permissions.

[node]: https://nodejs.org/en/
[yarn]: https://yarnpkg.com/lang/en/
[GitHub API access token]: https://github.com/settings/tokens

```
git clone https://github.com/sourcecred/sourcecred.git
cd sourcecred
yarn install
yarn backend
node bin/sourcecred.js load REPO_OWNER REPO_NAME --github-token=GH_TOKEN
# this loads sourcecred data for a particular repository
yarn start
# then navigate to localhost:3000 in your browser
```

For example, if you wanted to look at cred for [ipfs/js-ipfs], you could run:
```
$ node bin/sourcecred.js load ipfs js-ipfs --github-token=YOUR_GH_TOKEN
```

[ipfs/js-ipfs]: https://github.com/ipfs/js-ipfs

### Contributing

If you would like to contribute to SourceCred:
* Join our [Discord] and let us know what issue you'd like to work on. We can
guide you through the architecture, and assign you to the relevant issue.
* Fork the repository.
* Follow the installation and setup instructions as above.

Once your changes are ready for test and review:
* `yarn prettify`, which runs [prettier] to format your code
* `yarn travis`
* Submit your pull request

[prettier]: https://github.com/prettier/prettier
[Discord]: https://discord.gg/tsBTgc9
