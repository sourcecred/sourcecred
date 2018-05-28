# Design: Address–payload unification

The purpose of this document is to describe a system by which we can
remove the hard separation between node addresses and payloads, as
described in [sourcecred/sourcecred#190][issue-190].

[issue-190]: https://github.com/sourcecred/sourcecred/issues/190

This document typechecks—run its source through [`print_code_fences`]
and copy the result into https://flow.org/try.

[`print_code_fences`]: https://gist.github.com/wchargin/e371d4f3047cf5d89e7ff9bb47224243

This document was written at 2b301f91597a4502612f53a62bdf0367b9249bd4;
temporal references like “current” and “unchanged” have this reference
point.

## Core structures

The `Address` type is, for now, unchanged:

```javascript
type Address = {|
  +pluginName: string,
  +type: string,
  +id: string,
|};
```

At the core are two interfaces. First is `NodePayload`:

```javascript
interface NodePayload {
  address(): Address;
  toJSON(): any;
}
```

Plugins are expected to have a variety of subclasses of `NodePayload`,
one for each logical type. These classes can provide domain-specific
porcelain. For instance, the GitHub plugin might have:

```javascript
type GithubNodeType = "PULL_REQUEST" | "PULL_REQUEST_COMMENT"; // e.g.
type GithubNodeRecord = PullRequestRecord | PullRequestCommentRecord;
class GithubNodePayload<+T: GithubNodeRecord> implements NodePayload {
  +_record: T;
  +_type: GithubNodeType;
  constructor(record: T, type: GithubNodeType) {
    this._record = record;
    this._type = type;
  }
  address() {
    return {
      pluginName: "sourcecred/github-beta",
      type: this._type,
      id: this.url(),
    };
  }
  url() {
    return this._record.url;
  }
  toJSON(): Compatible<GithubNodeJson> {
    const data = {type: this._type, record: this._record};
    return toCompat(GITHUB_COMPAT_INFO, data);
  }
}
type GithubNodeJson = {|
  +type: GithubNodeType,
  +record: GithubNodeRecord,
|};
const GITHUB_COMPAT_INFO: CompatInfo = {
  type: "sourcecred/sourcecred/github/node-payload",
  version: "0.1.0",
};

type PullRequestRecord = {|
  +url: string,
  +number: number,
  +title: string,
  +body: string,
|};
class PullRequestPayload extends GithubNodePayload<PullRequestRecord> {
  constructor(record: PullRequestRecord) {
    super(record, "PULL_REQUEST");
  }
  number(): number { return this._record.number; }
  title(): string { return this._record.title; }
  body(): string { return this._record.body; }
}

type PullRequestCommentRecord = {|+url: string /* elided */|};
declare class PullRequestCommentPayload extends GithubNodePayload<
  PullRequestCommentRecord
> {
  constructor(record: PullRequestCommentRecord): void;
  /* elided */
}
```

Note also that `NodePayload`s exist outside the context of a graph: they
simply define data.

The second core interface is `NodeReference`:

```javascript
interface NodeReference {
  graph(): Graph;
  address(): Address;
  get(): ?Node<any, any>;

  neighbors(options?: NeighborsOptions): Iterator<Neighbor<any>>;
}
type NeighborsOptions = {|
  +nodeType?: string,
  +edgeType?: string,
  +direction?: "IN" | "OUT" | "ANY",
|};
type Neighbor<+T: NodeReference> = {|
  +ref: T,
  +edge: Edge,
|};
```

Here, we make use of the following useful type alias, which binds
together the two core interfaces:

```javascript
type Node<NR: NodeReference, NP: NodePayload> = {|
  +ref: NR,
  +payload: NP,
  +address: Address,
|};
```

That is, a `Node<NR, NP>` is just a pair of an `NR` and an `NP`.

Note that a `NodeReference` is tied to a specific node and a specific
graph. The `core/graph.js` module itself will include one important
implementation of this interface:

```javascript
class IndexedNodeReference implements NodeReference {
  _graph: Graph;
  _address: Address;
  _index: ?number;
  _indexVersion: number;  // explained below

  constructor(graph, address, index, version) { /* assignments */ }

  graph() { return this._graph; }
  address() { return this._address; }

  get() {
    this._ensureUpToDate();
    if (this._index == null) {
      return undefined;
    } else {
      return this._graph._nodes[this._index].value;
    }
  }

  neighbors(options?: NeighborsOptions) {
    this._ensureUpToDate();
    if (this._index == null) {
      return [].values();
    } else {
      return this._graph._internalNeighbors(this._index, options);
    }
  }

  _ensureUpToDate() {
    if (this._graph._indexVersion !== this._indexVersion) {
      this._indexVersion = this._graph._indexVersion;
      this._index = this._graph._addressToIndex(this._address);
    }
  }
}
```

The salient point of this implementation is that it enables fast access
of graph operations by remaining inside the integer-indexed layer,
without leaking to clients the details of how this works. Notable in
this implementation is the `_indexVersion` field, which enables a graph
to garbage-collect, compress, permute, or otherwise change its node
index without breaking extant references and without needing to keep
track of them: any such operation simply increments the graph’s
`_indexVersion` attribute, and any `IndexedNodeReference` will pick up
the change on any subsequent actions. Again, though, this is just a
convenient implementation detail.

Clients won’t directly use `IndexedNodeReference`, though; this will be
a non-exported class of the `core/graph.js` module. Instead, they will
provide a semantic extension of `NodeDelegateReference`:

```javascript
class NodeDelegateReference implements NodeReference {
  _base: NodeReference;
  constructor(base: NodeReference) {
    this._base = base;
  }
  graph() { return this._base.graph(); }
  address() { return this._base.address(); }
  get() { return this._base.get(); }
  neighbors(options?: NeighborsOptions) {
    return this._base.neighbors(options);
  }
}
```

(Note: `NodeDelegateReference` should actually have `_base` as a
`Symbol`, but doing so requires Flow-appeasing hackery that I don’t want
to include in this high-level overview.)

By extending this class, plugins gain great power:

```javascript
class GithubNodeReference extends NodeDelegateReference {
  constructor(base: NodeReference) {
    super(base);
    const address = base.address();
    if (address.pluginName !== "sourcecred/github-beta") {
      throw new Error("pluginName: " + address.pluginName);
    }
  }
}

class PullRequestReference extends GithubNodeReference {
  constructor(base: NodeReference) {
    super(base);
  }
  *comments(): Iterator<PullRequestCommentReference> {
    for (const neighbor of this.neighbors({
      direction: "OUT",
      nodeType: "PULL_REQUEST_COMMENT",
      edgeType: "CONTAINS",
    })) {
      if (!(neighbor.ref instanceof PullRequestCommentReference)) {
        throw new Error(neighbor.ref.constructor.name);
      }
      yield neighbor.ref;
    }
  }
}

declare class PullRequestCommentReference extends GithubNodeReference {
  /* elided */
}
```

## Plugin handlers

Before the methods on `Graph` can be updated to take advantage of these
structures, a graph needs to know about the different kinds of plugins.
A plugin handler has the following interface:

```javascript
interface PluginHandler<NR: NodeReference, NP: NodePayload> {
  /**
   * Enrich a base reference with plugin-/domain-specific properties.
   */
  createReference(baseReference: NodeReference): NR;

  /**
   * Deserialize a JSON payload, which is guaranteed to be the
   * serialization of a previous `NP`.
   */
  createPayload(json: Json): NP;

  /**
   * Provide the name of the plugin.
   * Should return a constant string.
   */
  pluginName(): string;
}
```

A common implementation might be something like:

```javascript
const GITHUB_PLUGIN_NAME = "sourcecred/github-beta"
class GithubPluginHandler
implements PluginHandler<GithubNodeReference, GithubNodePayload<any>> {
  createReference(reference) {
    const address = reference.address();
    if (address.pluginName !== GITHUB_PLUGIN_NAME) {
      throw new Error("pluginName: " + address.pluginName);
    }
    const type: GithubNodeType = ((address.type: string): any);
    switch (type) {
      case "PULL_REQUEST":
        return new PullRequestReference(reference);
      case "PULL_REQUEST_COMMENT":
        return new PullRequestCommentReference(reference);
      default:
        // eslint-disable-next-line no-unused-expressions
        (type: empty);
        throw new Error("type: " + type);
    }
  }

  createPayload(raw: any) {
    const json: GithubNodeJson = fromCompat(GITHUB_COMPAT_INFO, raw);
    const {type, record: rawRecord} = json;
    const record: any = rawRecord;
    switch (type) {
      case "PULL_REQUEST":
        return new PullRequestPayload(record);
      case "PULL_REQUEST_COMMENT":
        return new PullRequestCommentPayload(record);
      default:
        // eslint-disable-next-line no-unused-expressions
        (type: empty);
        throw new Error("type: " + type);
    }
  }

  pluginName() { return GITHUB_PLUGIN_NAME; }
}
```

## The `Graph` class

A graph is associated with a fixed set of plugins:

```javascript
type Plugins = $ReadOnlyArray<PluginHandler<any, any>>;
```

The graph learns about these at construction time, either via the
constructor or the `static fromJSON` method.

Graphs, of course, also need to refer to edges. In this proposal, we
leave edges structurally unchanged, but remove their type parameters:

```javascript
type Edge = {|
  +address: Address,
  +src: Address,
  +dst: Address,
  +payload: any,
|};
```

The `Graph` class then looks something like this:

```javascript
declare class Graph /* no type parameters! */ {
  constructor(plugins: Plugins): void;

  copy(): Graph;
  equals(that: Graph): boolean;

  toJSON(): GraphJson;
  static fromJSON(plugins: Plugins, json: GraphJson): Graph;

  plugins(): Plugins;

  addNode(np: NodePayload): this;
  addEdge(edge: Edge): this;

  removeNode(address: Address): this;
  removeEdge(address: Address): this;

  node(address: Address): ?Node<any, any>;
  edge(address: Address): ?Edge;
  ref(address: Address): NodeReference;

  nodes(filter?: {|+type?: string|}): Iterator<Node<any, any>>;
  edges(filter?: {|+type?: string|}): Iterator<Edge>;

  static mergeConservative(Iterable<Graph>): Graph;

  // Some implementation details (but not all of them)…
  _nodes: {|+address: Address, +value: Node<any, any> | void|}[];
  _indexVersion: number;
  _internalNeighbors(
    number: number,
    options?: NeighborsOptions
  ): Iterator<Neighbor<any>>;
  _addressToIndex(address: Address): ?number;
}
type GraphJson = {/* elided */};
```

I’ll draw attention to a few things in this proposal, which I am open to
changing.

  - APIs provide iterators by default. Conversion with `Array.from` is
    easy. Retrofitting clients to stream data when possible only becomes
    harder as we go on.
  - I’ve removed `neighborhood`. Clients of `Graph` will certainly want
    to compute neighborhoods, but they should always do so via a
    `NodeReference`, probably one that eventually delegates to an
    `IndexedNodeReference`. Failure to do so creates a needless
    performance hit. If we like this pattern, we can specify future
    structural methods (like `connectedComponent` or something) in this
    way as well.
  - I’ve removed the binary version of `mergeConservative`. As far as I
    can tell, it is strictly inferior to the variadic version, and
    encourages bad performance.
  - I’ve removed the non-conservative `merge`. This method actually
    provided some value in principle, but we never actually used it. If
    we want to keep it around, that’d be fine with me.

Some things that are implicit from the types, but are worth mentioning:

  - Whenever possible, the graph will retain a canonical `NodeReference`
    instance for any given node: that is, it will try to call
    `createReference` only once. Plugins shouldn’t depend on this for
    correctness, but it might be helpful for their caching patterns.
  - The new serialized form will attach plugin names to nodes, either
    individually or by bucketing (each has advantages). Nodes themselves
    will be serialized `NodePayload`s. At `fromJSON` time, the graph
    will re-enrich all nodes with their appropriate plugins to get
    payloads and references.

The semantics for `Graph.ref` are somewhat subtle. There are four cases,
depending on the `address` argument passed to this method:

  1. The address corresponds to a node in the graph.
  2. The address corresponds to a node that does not appear in the
     graph, but has incident edges in the graph.
  3. The address corresponds to a phantom node—a node that does not
     exist in the graph and does not have incident edges, but still
     appears in `_nodes` due to a prior call to `removeNode`.
  4. The address has never been seen before.

In all cases, we will return a `NodeReference` constructed by the
appropriate plugin. This implies that calling this method may mutate the
internal storage in the graph: in case (4), we will have to create a
phantom node to keep track of the reference. This therefore further
implies that graphs will be hard-pressed to perform any kind of “index
pruning” by removing phantom nodes, lest they invalidate existing
references.

## Conclusion and next steps

This API encompasses an improvement to how nodes are handled. Clients
will usually work with either a `Node<NR, NP>` or a `NodeReference`
alone. There is still a bit of friction in that some methods are
inherently on the reference while others are on the payload, but this is
not actually a problem when the `Node<NR, NP>` is treated as a package
(not destructured): consider

```javascript
function someActions(
  someRef: PullRequestReference,
  someNode: Node<PullRequestReference, PullRequestPayload>
) {
  someRef.comments();        // easy
  someNode.ref.comments();   // no problem
  someNode.payload.title();  // piece of cake
}
```

You have to pay a few extra characters for `.ref` or `.payload`, but the
typechecker will help you out.

We may want to do something similar for edges in the future, but also
perhaps not. Edges are definitely different from nodes: we never really
reference them by address (`Graph.edge` is currently never called
outside of test code and `graph.js` itself), so something more like
content-addressing might make more sense. But that is not an entirely
straightforward change from our current model.

I (@wchargin) still think that we should plan to eventually remove
`type` from being privileged on the address. The `type` and `id`
properties together actually represent a plugin-specific set of values
that are used to uniquely determine the identity of a node, and which we
therefore require to always be available—even when the full contents of
a node are not loaded. This grants us more flexibility: perhaps it makes
more sense to have

```javascript
type UserId = {|+type: "USER", +login: string|};
type PullRequestId = {|
  +type: "PULL_REQUEST",
  +repositoryOwner: string,
  +repositoryName: string,
  +number: number,
|};
```

Then, functions like `neighbors` and `nodes` greatly increase in power,
as we filter not just on `type` but on an arbitrary subset of these
identifying characteristics:

```javascript
const myTreeEntries = neighborsV2({
  direction: "OUT",
  nodeFilter: {
    pluginName: "sourcecred/git-beta",
    id: {
      type: "TREE_ENTRY",
      name: "pygravitydefier",
    },
  },
});
const allFirstPrs = nodesV2({
  pluginName: "sourcecred/github-beta",
  id: {
    type: "PULL_REQUEST",
    number: 1,
  },
});

type FilterV2 = {|+pluginName?: string, +id?: Object|};
type NeighborsOptionsV2 = {|
  +nodeFilter?: FilterV2,
  +edgeFilter?: FilterV2,
  +direction?: "IN" | "OUT" | "ANY",
|};

declare function neighborsV2(
  options?: NeighborsOptionsV2
): Iterator<Neighbor<any>>;
declare function nodesV2(filter?: FilterV2): Iterator<Node<any, any>>;
```

---

Some external shims, just to make the document typecheck…

```javascript
type Json =
  | string
  | number
  | {[string]: Json}
  | $ReadOnlyArray<Json>
  | true
  | false
  | null
  ;
type CompatInfo = {|
  +type: string,
  +version: string,
|};
opaque type Compatible<T> = [CompatInfo, T];
declare function toCompat<T>(compatInfo: CompatInfo, obj: T): Compatible<T>;
declare function fromCompat<T>(
  compatInfo: CompatInfo,
  obj: Compatible<T>,
  handlers: ?{[version: string]: (any) => T}
): T;
```
