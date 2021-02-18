---
title: Plugin Design Doc
author: Kevin Siegler (@topocount)
created: 2021-02-02
---

# Plugin Design Doc

## Overview

SourceCred plugins are almost completely beholden to their datasources.
A local cache exists, but its only real purpose is to provide a local source of data for graph creation.
Plugin caches cannot stand by themselves for too long and are easily blown out by upstream changes.
Additionally, caches are only built in environments local to graph creation.
They cannot easily be shared over a network, or provide any real source of truth outside of the API.

[@hammadj] has designed a new [plugin model] that relies upon a `Fetcher`,
`DataArchive` and a `DataProvider` as a persistent mirror of data from a specific platform.
This is a significant improvement over the existing model described above because
it allows for the persistence of cred data independent of a platform's ability
(or willingness) to provide the raw information needed to build cred data over time.
![snapshot of plugin model]

[@hammadj]: https://github.com/hammadj
[plugin model]: https://lucid.app/lucidchart/591bf744-fdbe-4aa2-a0c5-4be90f436a71/view?page=0_0#
[snapshot of plugin model]: https://lucid.app/publicSegments/view/37798d92-6537-4335-b0ba-8f25658a281c/image.png

## Informal Specification

Below is an informal specification for this interface [sketch].

[sketch]: https://gist.github.com/topocount/50da938ce6ae18c044ef4d2ae6f98013

### DataProvider

A `DataProvider` acts as a mirror for some source of community activity.
In terms of our current use cases, this means that it will periodically query an API and store successful responses persistently in an archive.
DataProviders are specifically responsible for:

- obtaining data from the API
- exporting successfully obtained data to a `DataArchive`
- Providing a read-only interface to be utilized by plugins to construct weighted
  graphs.

Developers will be responsible for contructing each data source's `DataProvider` [schema].
Schemas should do the following:

- Store all classes of information in an easily accessible schema.
  Try to normalize data as much as possible. to enforce consistency across the dataset
- Maintain synchronization timestamps so it's easy to see how recently each table or class of data has been updated.

The DataProvider should also contain the logic for serializing this data into a
blob, and also deserializing it for plugin consumption.

### DataArchive

A `DataArchive` is a platform or package in which mirrored data is stored.
`DataArchive`s could be built around [Ceramic], [Github], or anything else that can persist data.
`DataArchive`s are specifically responsible for:

- storing data received from a `DataProvider` persistently
- serving this mirrored data via its own API to plugins.

[schema]: https://en.wikipedia.org/wiki/Database_schema
[ceramic]: https://developers.ceramic.network
[github]: https://docs.github.com/en

## Implementation Steps

The proof of concept for this design will be a Discord Datastore and a props
plugin that builds a graph from the data provided by the store.

1. Spec out an interface for the `DataProvider` and DataAdapter. These interfaces
   should make it possible for a service to interact with the `DataProvider`, while
   still allowing for a enough flexibility for `DataProvider`s to be written for
   arbitrary APIs.
   SourceCred typically implements major changes incrementally, with a strong bias towards integrating early and then adding features as the need emerges.
   In keeping with this pattern, the initial API interfaces will be simply `read` and `write`. for the DataStore and DataAdapter, rspectively.

2. Implement a `DataProvider` for Discord
3. Implement a `DataArchive` and class for Discord using Github to store blobs.
4. Implement a [Props] plugin that is only concerned with constructing a graph
   from props channel activity.
5. (optional) fork the Discord plugin and refactor it to consume the discourse
   `DataArchive` as opposed to the Discord API directly.

[props]: https://sourcecred.io/docs/beta/our-platforms#special-channels

## Future Considerations

Some potential future features include:

- creating more granular APIs for `DataArchives` more suitable for micro-plugins
  dependent upon Discord data.
- Implementing additional microplugins, e.g. for meetings.
- Implementing this stack for Github to expand support for project management
  workflows.

Interesting ideas to further entertain include:

- allowing instances to act as plugins and supply their own graphs. This is
  potentially how we could build cross-instance cred networks.
- allowing plugins to read graphs directly from other plugins.
