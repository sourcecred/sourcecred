# [SourceCred](https://sourcecred.io)

[![Build Status](https://circleci.com/gh/sourcecred/sourcecred.svg?style=svg)](https://circleci.com/gh/sourcecred/sourcecred)
[![Discourse topics](https://img.shields.io/discourse/https/discourse.sourcecred.io/topics.svg)](https://discourse.sourcecred.io)
[![Discord](https://img.shields.io/discord/453243919774253079.svg)](https://discord.gg/tsBTgc9)
[![Greenkeeper badge](https://badges.greenkeeper.io/sourcecred/sourcecred.svg)](https://greenkeeper.io/)

SourceCred creates reputation networks for open-source projects.
Any open-source project can create its own _cred_, which is a reputational metric showing how much credit contributors deserve for helping the project.
To compute cred, we organize a project’s contributions into a graph, whose edges connect contributions to each other and to contributors.
We then run PageRank on that graph.

To learn more about SourceCred’s vision and values, please check out [our website] and our [forum].
One good forum post to start with is [A Gentle Introduction to Cred].

For an example of SourceCred in action, you can see SourceCred’s own [prototype cred attribution][prototype].

[our website]: https://sourcecred.io/
[prototype]: https://sourcecred.io/prototype/
[A Gentle Introduction to Cred]: https://discourse.sourcecred.io/t/a-gentle-introduction-to-cred/20

## Current Status

We have a [prototype] that can generate a cred attribution based on GitHub interactions (issues, pull requests, comments, references, etc.).
We’re working on adding more information to the prototype, such as tracking modifications to individual files, source-code analysis, GitHub reactions, and more.

### Running the Prototype

If you’d like to try it out, you can run a local copy of SourceCred as follows.
First, make sure that you have the following dependencies:

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

You'll stil need to create a GitHub token to use as an environment variable
(shown later). First, run the following commands to clone and build SourceCred:

```Bash
git clone https://github.com/sourcecred/sourcecred.git
cd sourcecred
yarn install
yarn backend
node bin/sourcecred.js load REPO_OWNER/REPO_NAME
```

Loading a repo can take a few minutes. When it is finished, it will exit. Next, we can start sourcecred:

```Bash
yarn start
```

Finally, we can navigate a browser window to `localhost:8080` to view generated data.

### Running with Docker

Optionally, you can build and run sourcecred in a container to avoid installing dependencies
on your host. First, build the container:

```bash
$ docker build -t sourcecred .
```

If you don't want to build, the container is also provided at [vanessa/sourcecred](https://hub.docker.com/r/vanessa/sourcecred)

```bash
$ docker pull vanessa/sourcecred
$ docker tag vanessa/sourcecred sourcecred
```

You will still need to export a GitHub token, and then provide it to the container
when you run it. Notice that we are also binding port 8080 so we can
view the web interface that will be opened up.  The only argument needed is the 
GitHub repository to generate the sourcecred for:

```bash
REPOSITORY=sfosc/sfosc
$ SOURCECRED_GITHUB_TOKEN="xxxxxxxxxxxxxxxxx" \
    docker run --name sourcecred --rm --env SOURCECRED_GITHUB_TOKEN -p 8080:8080 sourcecred "${REPOSITORY}"
```

```bash

We are running in detached mode (-d) so it's easier to remove the container after. After running
the command, you can inspect it's progress like this:

```bash
$ docker logs sourcecred
  GO   load-sfosc/sfosc
  GO   github/sfosc/sfosc
 DONE  github/sfosc/sfosc: 25s
  GO   compute-cred
 DONE  compute-cred: 1s
 DONE  load-sfosc/sfosc: 26s
...
```

It will take about 30 seconds to do the initial build, and when the web server is running you'll see this at the end:

```bash
...
[./node_modules/react/index.js] 190 bytes {main} {ssr} [built]
[./src/homepage/index.js] 1.37 KiB {main} [built]
[./src/homepage/server.js] 5.61 KiB {ssr} [built]
    + 1006 hidden modules
ℹ ｢wdm｣: Compiled successfully.
```

**Important** Although we expose port 0.0.0.0 to be viewable on your host,
this is _not a production_ deployment and you should take precaution in how
you use it.

Then you can open up to [http://127.0.0.1:8080](http://127.0.0.1:8080) to see the interface!

![img/home-screen.png](img/home-screen.png)

You can click on "prototype" to see a list of repositories that you generated (we just did sfosc/sfosc):

![img/prototype.png](img/prototype.png)

And then finally, click on the repository name to see the graph.

![img/graph.png](img/graph.png)

When you are finished, you can press Control+c to kill the container.
If you want to run in detached, add a `-d` argument, and optionally `--rm`
to remove when you stop it.

#### Examples

If you wanted to look at cred for [ipfs/js-ipfs], you could run:

```Bash
export SOURCECRED_GITHUB_TOKEN=YOUR_GITHUB_TOKEN
node bin/sourcecred.js load ipfs/js-ipfs
```

[ipfs/js-ipfs]: https://github.com/ipfs/js-ipfs

You can also combine data from multiple repositories into a single graph.
To do so, pass multiple repositories to the `load` command, and specify an “output name” for the repository.
For instance, the invocation

```Bash
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

[forum]: https://discourse.sourcecred.io/
[Discord]: https://discord.gg/tsBTgc9
[contributing guide]: https://github.com/sourcecred/sourcecred/blob/master/CONTRIBUTING.md
[good first issues]: https://github.com/sourcecred/sourcecred/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22

## License

SourceCred is dual-licensed under Apache 2.0 and MIT terms:

  * Apache License, Version 2.0, ([LICENSE-APACHE](LICENSE-APACHE) or <https://www.apache.org/licenses/LICENSE-2.0>)
  * MIT License ([LICENSE-MIT](LICENSE-MIT) or <https://opensource.org/licenses/MIT>)

## Acknowledgements

We’d like to thank [Protocol Labs] for funding and support of SourceCred.
We’d also like to thank the many open-source communities that produced the software that SourceCred is built on top of, such as [Git] and [Node][Node github].

[Protocol Labs]: https://protocol.ai
[Git]: https://github.com/git/git
[Node github]: https://github.com/nodejs/node
