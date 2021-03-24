---
title: Plugin Refactor Technical Design
author: Kevin Siegler (@topocount)
created: 2021-02-02
updated: 2021-03-24
---

# Plugin Refactor Technical Design

# Introduction

## Rationale

SourceCred's plugin model is currently not very scalable, extensible, or
persistent. This problem manifests itself in a few different ways.

### Scalability

Adding a plugin to a SourceCred instance significantly increases an instance's
load time when pulling the latest plugin data, especially if the community is
either (1) large, (2) active, (3) has been using a plugin's platform for some
time, or some combination of these three factors. Effectively, the longer an
instance is in use in a growing community, the harder it becomes to maintain,
due to a growth in plugin data.

### Extensibility

In some cases it may be desirable to utilize plugin data more than once, each
with a different configuration in order to target specific contributions. The
current design requires that users effectively download a duplicate set of
plugin data in order to realize this use case, which also presents a
scalability problem. We need to facilitate this use case by de-duplicating this
data dependency, and allowing multiple plugin instances to build graphs from
the same dataset.

We also don't support third party plugins with our current semantics. Finding
a way to support community-developed plugins will greatly facilitate the growth
of our ecosystem.

### Persistence

SourceCred plugins are almost completely beholden to their datasources.
A local cache exists, but its only real purpose is to provide a local source of
data for graph creation. Plugin caches cannot stand by themselves for too long
and are easily blown out by upstream changes. Additionally, caches are only
built in environments local to graph creation. They cannot easily be shared
over a network, or serve as a source of truth outside of the API.

Specifying interfaces that facilitate the persistence of plugin data outside of
an instance will significantly improve cred calculation speed, because plugins
can then load data in parallel.

This also will enable plugin data to be used
with blockchain oracles, enabling decentralized communities to verify the
correctness of a grain distribution, starting with the the plugin data used to
generate cred scores.

### Background

SourceCred's plugin model was designed to make the central administration and
maintenance of an instance simple. Local plugin data was only ever expected to
be loaded into the same environment in which cred graphs would be constructed,
and initially, there was relatively little cost to load data from a plugin. The
order of magnitude was minutes instead of hours. However, the combination of
our ecosystem's communities growing in size and enforced rate limits on many
platform APIs have caused some growing pains for our communities. Additionally,
new ways to use plugins are beginning to emerge and we want to be able to
support these use cases.

### Terminology

**Plugin** A connection between a tool used by a community and SourceCred. It
processes the community's activity and outputs a cred graph.

**Load Step** The first step in a plugin's process, where a plugin pulls in
data from a remote source.

**Fetcher** The part of the plugin that requests data from the tool.

**DataProvider** the part of the plugin that organizes plugin data so a cred
graph can easily be constructed. Fetchers write the data they receive to a
DataProvider. Graphs are constructed from the data stored in a DataProvider.

**DataArchive** A space to persist snapshotted DataProvider contents.

### Non-goals

- Optimizing specific DataProviders to robustly persist data for all API
  operations. This may be a priority after this new architecture is implemented
  and proven.

- Creating oracles from data stored in Data Archives.

- Writing Developer Documentation for new plugin interfaces specified herein.

- Supporting multiple instances of the same plugin. Plugin data may be utilized
  by different plugins, but a single plugin instance should be able to support
  multiple repos/servers/endpoints/etc.

# Design Proposal

This design is split into two distinct parts

**Plugin-Instance Contract** This section specifies the new interfaces for
instances to interact with plugins. This will effectively be the new contract
that enables 3rd party plugins to be used in instances.

**Plugin Architecture** This section lays out an API that supports the remote
persistence of plugin data. This specification accomplishes our goals related
to extensibility by enabling multiple plugins to utilize a single data source.
This also allows instances to scale with community size and plugin count
by decoupling the load step from the process of fetching data from a platform
API.

## Plugin-Instance Contract

Plugins currently integrate into SourceCred core via the
[bundledPlugins.js] file. This file is part of the core repo and is therefore
not modifiable from within an instance. Within an instance, plugins are
specified as active via the root [sourcecred.json] file by the instance
maintainer.

[bundledplugins.js]: https://github.com/sourcecred/sourcecred/blob/3e77f40a2335c597d18f192e36e756f6c452fc7b/src/api/bundledPlugins.js
[sourcecred.json]: https://github.com/sourcecred/cred/blob/887584b602eee1ad8e68d88b2733070d1d6732fa/sourcecred.json

### Data Model

[bundledPlugins.js] may serve as the integration point between core code and
plugin code, but it is also effectively a white-list. By moving this integration
point into the scope of the instance, users will be able to import conformant
plugins that export the correct API. This will necessitate bundling plugins as
distinct npm packages. Additionally, the function of [bundledPlugins.js] and
[sourcecred.json] can be merged into a `sourcecred.js` instance configuration
file.

This configuration file is where instance maintainers would import plugins from
`node_modules` and pass the `Plugin` implementations into and exported config
file. This is similar to how webpack.config.js files are created.

#### sourcecred.js config file specification

sourcecred.js should export an object containing dictionary mappings from a
string (aliased as a `PluginName`) to a plugin instantiation.

In code, this file would import like

```javascript
// @flow
import activePlugins from "./sourcecred.js";

const pluginNames = activePlugins.keys();
const plugins = activePlugins.values();
```

#### Example config file

The [Plugin] interface contains all functionality and metadata needed, so that
interface does not need to change. The plugin.js file just needs to be exported
(ideally as the default) from the plugin repo.

[plugin]: https://github.com/sourcecred/sourcecred/blob/7cee24d8d5fefa80c0d3b885d3741d301ae4fe45/src/api/plugin.js

##### sourcecred.js

```javascript
// @flow

const DiscordPlugin = require("@sourcecred/plugin-discord");
const GithubPlugin = require("@sourcecred/plugin-github");
const DiscoursePlugin = require("@sourcecred/plugin-discourse");
const PropsPlugin = require("@sourcecred/plugin-props");

type PluginName = string;

const discourse = new DiscoursePlugin();
const github = new GithubPlugin();
const props = new PropsPlugin();
const discord = new DiscordPlugin();

const enabledPlugins: {[PluginName]: Plugin} = {
  discourse,
  github,
  props,
  discord,
};

export default enabledPlugins;
```

## Internal Plugin Architecture

### Data Model

[@hammadj] has designed a new [plugin model] that relies upon a `Fetcher`,
`DataArchive` and a `DataProvider` as a persistent mirror of data from a specific platform.
This is a significant improvement over the existing model described above because
it allows for the persistence of cred data independent of a platform's ability
(or willingness) to provide the raw information needed to build cred data over time.
![snapshot of plugin model]

[@hammadj]: https://github.com/hammadj
[plugin model]: https://lucid.app/publicSegments/view/973e10ec-2570-4c0a-8456-048919d00ea9/image.png
[snapshot of plugin model]: https://lucid.app/publicSegments/view/37798d92-6537-4335-b0ba-8f25658a281c/image.png

### API Definitions

Below is an informal specification for this interface [sketch].

[sketch]: https://gist.github.com/topocount/50da938ce6ae18c044ef4d2ae6f98013

#### DataProvider

A `DataProvider` acts as a mirror for some source of community activity.
In terms of our current use cases, this means that it will periodically query
an API and store successful responses persistently in an archive. DataProviders
are specifically responsible for:

- obtaining data from the API
- exporting successfully obtained data to a `DataArchive`
- Providing a read-only interface to be utilized by instances to construct weighted
  graphs.

Developers will be responsible for constructing each data source's
`DataProvider` [schema]. Schemas should do the following:

- Organize all classes of information to be easily accessible.
  Try to normalize data as much as possible, to enforce consistency across the dataset
- Maintain synchronization timestamps so it's easy to see how recently each
  table or class of data has been updated.

The DataProvider should also contain the logic for serializing this data into a
[blob], and also deserializing it for consumption within an instance.

[blob]: https://developer.mozilla.org/en-US/docs/Web/API/Blob

#### DataArchive

A `DataArchive` is a platform or package in which mirrored data is stored.
`DataArchive`s could be built around [Ceramic], [Github], or anything else that can persist data.
`DataArchive`s are specifically responsible for:

- storing data received from a `DataProvider` persistently
- serving this mirrored data via its own API to plugins.

[schema]: https://en.wikipedia.org/wiki/Database_schema
[ceramic]: https://developers.ceramic.network
[github]: https://docs.github.com/en

### Example Plugin Implementations

#### Standard Discourse Plugin

SourceCred's Discourse plugin stores data from Discourse's API in a SQLite
database. However, if we want to decouple fetching from the API from loading
data into an instance, we could set up a small service, or GitHub workflow
triggered by cron that regularly posts updated pulls to storage.

##### Components

**Fetcher Service** Runs a `Fetcher` script that periodically fetches from the
Discourse API, flattens, and posts the structured data via a `DataProvider`.

**Storage** The platform or medium that persists the flattened data. This is
our `DataArchive`. For the purpose of minimizing changes, let's keep this
as GitHub. The `DataArchive` implementation could point to a folder within its
own cache, but that doesn't make it as easy for other plugins to utilize the
data. In order to allow other plugins to consume the data, and for a cleaner
separation of concerns, blobs will be stored in a separate repository.

##### Process

1. The **Fetcher Service** runs the `Fetcher` script to query a Discourse API.
   Fetched Data is stored in a SQLite database, as it is in the
   current Discourse plugin.
2. Via an extension to the fetcher script, the `DataProvider` flattens the
   SQLite database into a blob, stores it in our `DataArchive` and publishes
   the address of the blob with a signature to **Storage**.
3. During the `load` step, the Discourse plugin, via a `DataProvider`
   1. requests the latest Discourse pull from the **Fetcher Service** or
      GitHub repo used for **Storage**.
   2. rehydrates the blob into a SQLite database on disk.

After step 3 above, the graph can then be constructed by the instance as it does
currently.

#### Maker's Oraclized Discourse Plugin

Maker wants to make grain distributions more trustless and decentralized.
One part of this process is publishing signed Discourse API pulls in Maker's
[oracle feed], and persisting them in decentralized storage. This is intended
to allow the community to replicate the cred scores and grain distributions
calculated for a given week, and verify the data used to generate them. A
time delay will be implemented between the calculation of the distribution and
the on-chain distributions of funds.

As an aside, note that this architecture doesn't quite conform to that of an
[oracle] since we're agnostic to how this process is started. Oracle data
is technically directly requested directly from a [smart contract].

##### Components

**Trusted Fetcher** A trusted fetcher is the actor who runs the Discourse
`Fetcher` scripts, then signs, stores, and publishes the mirror via a
`DataProvider` interface.

**IPFS/Ceramic** The decentralized storage medium that persists the flattened
API mirror. This is our `DataArchive`.

**Oracle Feed** The service the instance queries during the `load` step to
retrieve the location of the flattened API mirror within the `DataArchive`.

[oracle feed]: https://github.com/makerdao/oracles-v2
[oracle]: https://ethereum.org/en/developers/docs/oracles/
[smart contract]: https://ethereum.org/en/developers/docs/smart-contracts/

[![](https://mermaid.ink/img/eyJjb2RlIjoic2VxdWVuY2VEaWFncmFtXG4gICAgcGFydGljaXBhbnQgRCBhcyBEaXNjb3Vyc2UgQVBJXG4gICAgcGFydGljaXBhbnQgVCBhcyBUcnVzdGVkIEZldGNoZXJcbiAgICBwYXJ0aWNpcGFudCBBIGFzIERhdGEgQXJjaGl2ZSAoQ2VyYW1pYy9JUEZTKVxuICAgIHBhcnRpY2lwYW50IE8gYXMgT3JhY2xlIEZlZWRcbiAgICBwYXJ0aWNpcGFudCBJIGFzIEluc3RhbmNlXG5cbiAgICBsb29wIEZldGNoZXIgcnVucyBkYWlseVxuICAgICAgICBhdXRvbnVtYmVyXG4gICAgICAgIGxvb3AgRmV0Y2hlclxuICAgICAgICAgICAgVC0-PkQ6IHJlcXVlc3QgbGF0ZXN0IGZvcnVtIGRhdGFcbiAgICAgICAgICAgIGFjdGl2YXRlIERcbiAgICAgICAgICAgIEQtLT4-VDogcmVzcG9uc2VzIHN0b3JlZCBpbiBTUUxpdGUgREJcbiAgICAgICAgICAgIGRlYWN0aXZhdGUgRFxuICAgICAgICBlbmRcbiAgICAgICAgbG9vcCBXcml0ZWFibGUgRGF0YSBQcm92aWRlclxuICAgICAgICAgICAgVC0-PkE6IEZsYXR0ZW4gYW5kIHN0b3JlIFNRTGl0ZURCIGJsb2JcbiAgICAgICAgICAgIEEtLT4-VDogcmVjZWl2ZSBhZGRyZXNzIG9mIGRvY3VtZW50XG4gICAgICAgICAgICBULT4-TzogcHVibGlzaCBzaWduZWQgYXJjaGl2ZSBhZGRyZXNzIGluIG1lc3NhZ2UgdG8gb3JhY2xlIGZlZWRcbiAgICAgICAgZW5kXG4gICAgZW5kXG4gICAgXG4gICAgbG9vcCBEYXRhUHJvdmlkZXJcbiAgICAgICAgYXV0b251bWJlclxuICAgICAgICBJLT4-TzogaW5zdGFuY2UgcmVxdWVzdHMgbGF0ZXN0IERpc2NvdXJzZSBtZXNzYWdlIGZyb20gdGhlIE9yYWNsZSBGZWVkXG4gICAgICAgIE8tLT4-STogcGVyc2lzdCBtZXNzYWdlIGluIEluc3RhbmNlXG4gICAgICAgIEktPj5BOiBwdWxsIGZsYXR0ZW5lZCBTUUxpdGUgYmxvYlxuICAgICAgICBBLS0-Pkk6IHJlaHlkcmF0ZSBibG9iIGludG8gU1FMaXRlIERCIG9uIGRpc2tcbiAgICBlbmRcblxuIiwibWVybWFpZCI6eyJ0aGVtZSI6ImRlZmF1bHQifSwidXBkYXRlRWRpdG9yIjpmYWxzZX0)](https://mermaid-js.github.io/mermaid-live-editor/#/edit/eyJjb2RlIjoic2VxdWVuY2VEaWFncmFtXG4gICAgcGFydGljaXBhbnQgRCBhcyBEaXNjb3Vyc2UgQVBJXG4gICAgcGFydGljaXBhbnQgVCBhcyBUcnVzdGVkIEZldGNoZXJcbiAgICBwYXJ0aWNpcGFudCBBIGFzIERhdGEgQXJjaGl2ZSAoQ2VyYW1pYy9JUEZTKVxuICAgIHBhcnRpY2lwYW50IE8gYXMgT3JhY2xlIEZlZWRcbiAgICBwYXJ0aWNpcGFudCBJIGFzIEluc3RhbmNlXG5cbiAgICBsb29wIEZldGNoZXIgcnVucyBkYWlseVxuICAgICAgICBhdXRvbnVtYmVyXG4gICAgICAgIGxvb3AgRmV0Y2hlclxuICAgICAgICAgICAgVC0-PkQ6IHJlcXVlc3QgbGF0ZXN0IGZvcnVtIGRhdGFcbiAgICAgICAgICAgIGFjdGl2YXRlIERcbiAgICAgICAgICAgIEQtLT4-VDogcmVzcG9uc2VzIHN0b3JlZCBpbiBTUUxpdGUgREJcbiAgICAgICAgICAgIGRlYWN0aXZhdGUgRFxuICAgICAgICBlbmRcbiAgICAgICAgbG9vcCBXcml0ZWFibGUgRGF0YSBQcm92aWRlclxuICAgICAgICAgICAgVC0-PkE6IEZsYXR0ZW4gYW5kIHN0b3JlIFNRTGl0ZURCIGJsb2JcbiAgICAgICAgICAgIEEtLT4-VDogcmVjZWl2ZSBhZGRyZXNzIG9mIGRvY3VtZW50XG4gICAgICAgICAgICBULT4-TzogcHVibGlzaCBzaWduZWQgYXJjaGl2ZSBhZGRyZXNzIGluIG1lc3NhZ2UgdG8gb3JhY2xlIGZlZWRcbiAgICAgICAgZW5kXG4gICAgZW5kXG4gICAgXG4gICAgbG9vcCBEYXRhUHJvdmlkZXJcbiAgICAgICAgYXV0b251bWJlclxuICAgICAgICBJLT4-TzogaW5zdGFuY2UgcmVxdWVzdHMgbGF0ZXN0IERpc2NvdXJzZSBtZXNzYWdlIGZyb20gdGhlIE9yYWNsZSBGZWVkXG4gICAgICAgIE8tLT4-STogcGVyc2lzdCBtZXNzYWdlIGluIEluc3RhbmNlXG4gICAgICAgIEktPj5BOiBwdWxsIGZsYXR0ZW5lZCBTUUxpdGUgYmxvYlxuICAgICAgICBBLS0-Pkk6IHJlaHlkcmF0ZSBibG9iIGludG8gU1FMaXRlIERCIG9uIGRpc2tcbiAgICBlbmRcblxuIiwibWVybWFpZCI6eyJ0aGVtZSI6ImRlZmF1bHQifSwidXBkYXRlRWRpdG9yIjpmYWxzZX0)

[Higher Quality view](https://mermaid.ink/svg/eyJjb2RlIjoic2VxdWVuY2VEaWFncmFtXG4gICAgcGFydGljaXBhbnQgRCBhcyBEaXNjb3Vyc2UgQVBJXG4gICAgcGFydGljaXBhbnQgVCBhcyBUcnVzdGVkIEZldGNoZXJcbiAgICBwYXJ0aWNpcGFudCBBIGFzIERhdGEgQXJjaGl2ZSAoQ2VyYW1pYy9JUEZTKVxuICAgIHBhcnRpY2lwYW50IE8gYXMgT3JhY2xlIEZlZWRcbiAgICBwYXJ0aWNpcGFudCBJIGFzIEluc3RhbmNlXG5cbiAgICBsb29wIEZldGNoZXIgcnVucyBkYWlseVxuICAgICAgICBhdXRvbnVtYmVyXG4gICAgICAgIGxvb3AgRmV0Y2hlclxuICAgICAgICAgICAgVC0-PkQ6IHJlcXVlc3QgbGF0ZXN0IGZvcnVtIGRhdGFcbiAgICAgICAgICAgIGFjdGl2YXRlIERcbiAgICAgICAgICAgIEQtLT4-VDogcmVzcG9uc2VzIHN0b3JlZCBpbiBTUUxpdGUgREJcbiAgICAgICAgICAgIGRlYWN0aXZhdGUgRFxuICAgICAgICBlbmRcbiAgICAgICAgbG9vcCBXcml0ZWFibGUgRGF0YSBQcm92aWRlclxuICAgICAgICAgICAgVC0-PkE6IEZsYXR0ZW4gYW5kIHN0b3JlIFNRTGl0ZURCIGJsb2JcbiAgICAgICAgICAgIEEtLT4-VDogcmVjZWl2ZSBhZGRyZXNzIG9mIGRvY3VtZW50XG4gICAgICAgICAgICBULT4-TzogcHVibGlzaCBzaWduZWQgYXJjaGl2ZSBhZGRyZXNzIGluIG1lc3NhZ2UgdG8gb3JhY2xlIGZlZWRcbiAgICAgICAgZW5kXG4gICAgZW5kXG4gICAgXG4gICAgbG9vcCBEYXRhUHJvdmlkZXJcbiAgICAgICAgYXV0b251bWJlclxuICAgICAgICBJLT4-TzogaW5zdGFuY2UgcmVxdWVzdHMgbGF0ZXN0IERpc2NvdXJzZSBtZXNzYWdlIGZyb20gdGhlIE9yYWNsZSBGZWVkXG4gICAgICAgIE8tLT4-STogcGVyc2lzdCBtZXNzYWdlIGluIEluc3RhbmNlXG4gICAgICAgIEktPj5BOiBwdWxsIGZsYXR0ZW5lZCBTUUxpdGUgYmxvYlxuICAgICAgICBBLS0-Pkk6IHJlaHlkcmF0ZSBibG9iIGludG8gU1FMaXRlIERCIG9uIGRpc2tcbiAgICBlbmRcblxuIiwibWVybWFpZCI6eyJ0aGVtZSI6ImRlZmF1bHQifSwidXBkYXRlRWRpdG9yIjpmYWxzZX0)

##### Process

1. The **Trusted Fetcher** runs the `Fetcher` script to query Maker's Discourse
   forum. Fetched Data is stored in a SQLite database, as it is in the
   current Discourse plugin.
2. Via an extension to the fetcher script, the `DataProvider` flattens the
   SQLite database into a blob, stores it in our `DataArchive` and publishes
   the address of the blob with a signature to the **Oracle Feed**.
3. During the `load` step, the Discourse plugin, via a `DataProvider`
   1. requests the latest Discourse pull from the **Oracle Feed**.
   2. stores the signed message from the feed in the instance to persist the
      `DataArchive` address. The message is flushed from the feed after 4
      weeks.
   3. fetches the blob from the `DataArchive`.
   4. rehydrates the blob into a SQLite database on disk.

After step 3 above, the graph can then be constructed by the instance as it does
currently.

## Implementation Strategy

The proof of concept for this design will be the Oraclized Discourse plugin for
Maker.

1. Spec out an interface for the `DataProvider`. This interface
   should make it possible for a service to interact with the `DataProvider`,
   while still allowing for a enough flexibility for `DataProvider`s to be
   written for arbitrary APIs.
   SourceCred typically implements major changes incrementally, with a strong
   bias towards integrating early and then adding features as the need emerges.
   In keeping with this pattern, the initial API interfaces will be simply
   `read` and `write`.

2. Create a `DataProvider` for Discourse.
3. Implement a `DataArchive` and class for Discord using GitHub to store blobs.
4. Implement a [Props] plugin that is only concerned with constructing a graph
   from props channel activity.
5. (optional) fork the Discord plugin and refactor it to consume the discourse
   `DataArchive` as opposed to the Discord API directly!

[props]: https://sourcecred.io/docs/beta/our-platforms#special-channels

## Future Considerations

### Config Accessibility

One problem with this configuration interface is it's not easily modifiable in
a frontend. It might make sense to later add an `activation.json` file
that allows for the admins to manage whether or not a plugin is active. We'd
therefore ship the template instance with some default plugins, which could
then populate this config on first load. It might make sense for all plugins to
autopopulate some default or example configs if none exist.

### Other Possibilities

Some potential future features include:

- creating more granular APIs for `DataArchives` more suitable for micro-plugins
  dependent upon Discord data.
- Implementing microplugins, e.g. for meetings and a cross-platform props
  plugin.
- Implementing this stack for Github to expand support for project management
  workflows.

Interesting ideas to further entertain include:

- allowing instances to act as plugins and supply their own graphs. This is
  potentially how we could build cross-instance cred networks.
- allowing plugins to read graphs directly from other plugins.
