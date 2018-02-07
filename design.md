# SourceCred Design

## Design Goals
0. **Useful**

   SourceCred is not a pie-in-the-sky project to design a theoretically ideal system. It is useful software that will solve a pressing need: to provide a funding and incentive model for developing open-source software. As such, given the choice between the ideal and the attainable, we will choose the attainable.

1. **Ethical**

   We also recognize that by attempting to allocate credit and value, SourceCred is creating an economic system. Designing economic systems is a weighty responsibility in which small decisions may have large ethical consequences. By default, systems serve the powerful and connected. We will design SourceCred so that it also recognizes the least powerful and least connected contributors.

2. **Economic Value**

   SourceCred will provide a viable funding model for open projects. That means that the tokens it generates need to have some real economic value that is derived from the value of the project. Just allocating credit to contributors is not enough - there needs to be an reason for other agents in the ecosystem to pay contributors for their work.

3. **Robust Incentives**

   SourceCred will generate robust incentives, so that rational actors trying to earn cred in a project will do so by making material contributions to the project's success and usefulness. The incentive system should be adaptable, so that as participants find ways to game them, communities can modify them to avoid incentive traps.

4. **Easy to Adopt**

   SourceCred needs to be able to meet the open-source community where it is today, and to be easy to adopt and use. Basic usage of SourceCred should feel intuitive and low friction, e.g. by using GitHub reactions and messages from GitHub bots as a low-resolution way of engaging with the system. We should ask users to learn new behaviors, like setting up an Ethereum address, only when we're already delivering lots of value - not as a prerequisite.

5. **Fork-friendly and Upgradable**

   Forking is an essential part of software development. SourceCred should enable forks with relatively low friction; users should not be locked into a single branch due to the difficulty of forking the cred allocation. Similarly, it should be easy for projects to upgrade to a newer version of SourceCred, or switch to a fork of SourceCred.

6. **A Protocol**

   SourceCred is focused on an application: funding and incentives for open-source. However, at its core, it is also a protocol: a general purpose way to allocate credit, and flow tokens and rewards to contributors. As we build the application, we will also create clean interfaces so that the underlying protocol can be flexibly re-used in other domains.
