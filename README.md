## SourceCred

[![Build Status](https://travis-ci.org/sourcecred/sourcecred.svg?branch=master)](https://travis-ci.org/sourcecred/sourcecred)
[![Discord](https://img.shields.io/discord/453243919774253079.svg)](https://discord.gg/tsBTgc9)

## Vision

Open source software is amazing, and so are the creators and contributors who
share it. How amazing? It's difficult to tell, since we don't have good tools
for recognizing those people. Many amazing open-source contributors labor in
the shadows, going unappreciated for the work they do.

As the open economy develops, we need to go beyond [commit streaks] and
follower counts. We need transparent, accurate, and fair tools for recognizing
and rewarding open collaboration. SourceCred aims to do that.

[commit streaks]: https://www.mxsasha.eu/blog/2016/04/01/how-github-contribution-graph-is-harmful/

SourceCred will enable projects to create and track "cred", which is a
quantitative measure of how much value different contributors added to a
project. We'll do this by providing a basic data structure—a [cred graph]—into
which projects can add all kinds of information about the contributions that
compose it. For example, a software project might include information about
GitHub pull requests, function declarations and implementations, design
documents, community support, documentation, and so forth. We'll also provide
an algorithm ([PageRank]) which will ingest all of this information and produce
a "cred attribution", which assigns a cred value to each contribution, and thus
to the people who authored the contributions.

[cred graph]: https://en.wikipedia.org/wiki/Directed_graph
[PageRank]: https://en.wikipedia.org/wiki/PageRank

## Principles

SourceCred aims to be:

1. **Transparent**

   If it's to be a legitimate and accepted way of tracking credit in projects,
   cred attribution can't be a black-box. SourceCred will provide tools that
   make it easy to dive into the cred attribution, and see exactly why
   contributions were valued the way they were.

2. **Community-controlled**

   At the end of the day, the community of collaborators in a project will know
   best which contributions were important and deserve the most cred. No
   algorithm will do that perfectly on its own. To that end, we'll empower the
   community to modify the cred attribution, by adding human knowledge into the
   cred graph.

3. **Forkable**

   Disputes about cred attribution are inevitable. Maybe a project you care
   about has a selfish maintainer who wants all the cred for themself :(. Not
   to worry—all of the cred data will be stored with the project, so you are
   empowered to solve cred disputes by forking the project.

## Roadmap
SourceCred is currently in a very early stage. We are working full-time to
develop a MVP, which will have the following basic features:

- **Create**: The *GitHub Plugin* populates a project's GitHub data into a
  Contribution Graph. SourceCred uses this seed data to produce an initial,
  approximate cred attribution.

- **Read**: The *SourceCred Explorer* enables users to examine the cred
  attribution, and all of the contributions in the graph. This reveals why the
  algorithm behaved the way that it did.

- **Update**: The *Artifact Plugin* allows users to put their own knowledge into
  the system by adding new "Artifact Nodes" to the graph. An artifact node
  allows users to draw attention to contributions (or groups of contributions)
  that are particularly valuable. They can then merge this new information
  into the project repository, making it canonical.

## Community
Please consider joining [our Discord chat] or posting on [our forum].

[our Discord chat]: https://discord.gg/tsBTgc9
[our forum]: https://spectrum.chat/sourcecred

