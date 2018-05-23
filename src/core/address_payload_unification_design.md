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
}
```

Plugins are expected to have a variety of subclasses of `NodePayload`,
one for each logical type. These classes can provide domain-specific
porcelain. For instance, the GitHub plugin might have:

```javascript
type GithubNodeType = "PULL_REQUEST" | "PULL_REQUEST_COMMENT";  // e.g.
class GithubNodePayload<+T: {+url: string}> implements NodePayload {
  +record: T;
  +_type: GithubNodeType;
  constructor(record: T, type: GithubNodeType) {
    this.record = record;
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
    return this.record.url;
  }
  toJSON() { throw new Error("Must be implemented by subclass."); }
  static fromJSON() { throw new Error("Must be implemented by subclass."); }
}

type PullRequestJson = {|
  +url: string,
  +number: number,
  +title: string,
  +body: string,
|};
class PullRequestPayload extends GithubNodePayload<PullRequestJson> {
  constructor(record: PullRequestJson) {
    super(record, "PULL_REQUEST");
  }
  number(): number { return this.record.number; }
  title(): string { return this.record.title; }
  body(): string { return this.record.body; }
  toJSON() { return toCompat(PULL_REQUEST_COMPAT_INFO, this.record); }
  static fromJSON(json) { return fromCompat(PULL_REQUEST_COMPAT_INFO, json); }
}
const PULL_REQUEST_COMPAT_INFO: CompatInfo = {
  type: "sourcecred/sourcecred/github/PullRequest",
  version: "0.1.0",
};

type PullRequestCommentJson = {|+url: string, /* elided */|};
declare class PullRequestCommentPayload
extends GithubNodePayload<PullRequestCommentJson> {
  constructor(record: PullRequestJson): void;
  /* elided */
}
```

Note that a `NodePayload` should have well-defined serialization
behavior—probably, but not necessarily, via an explicit `toJSON` method.
By convention, nodes will have a `static fromJSON` for deserialization.

Note also that `NodePayload`s exist outside the context of a graph: they
simply define data.

The second core interface is `NodeReference`:

```javascript
interface NodeReference {
  graph(): Graph;
  address(): Address;
  get(): ?Node<any, any>;

  neighbors(options?: NeighborhoodOptions): Iterator<NodeReference>;
}
type NeighborhoodOptions = {|
  +nodeType?: string,
  +edgeType?: string,
  +direction?: "IN" | "OUT" | "ANY",
|};
```

Here, we make use of the following useful type alias, which binds
together the two core interfaces:

```javascript
type Node<NR: NodeReference, NP: NodePayload> = {|
  +ref: NR,
  +payload: NP,
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

  neighbors(options?: NeighborhoodOptions) {
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
  neighbors(options?: NeighborhoodOptions) {
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
      if (!(neighbor instanceof PullRequestCommentReference)) {
        throw new Error(neighbor.constructor.name);
      }
      yield neighbor;
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
  createReference(baseReference: NodeReference, payload: NP): NR;

  /**
   * Deserialize a payload, which is guaranteed to be the serialization
   * of a previous `NP`.
   */
  fromJSON(json: Json): NP;
}
```

Note that a perfectly legal “low-effort” implementation of this is:

```javascript
const noopHandler: PluginHandler<NodeReference, NodePayload> = {
  createReference: (reference, _) => reference,
  fromJSON: (json: any) => ({address() { return json.address; }}),
};
```

A more common implementation might be something like:

```javascript
class GithubPluginHandler
implements PluginHandler<GithubNodeReference, GithubNodePayload<any>> {
  createReference(reference) {
    const address = reference.address();
    if (address.pluginName !== "sourcecred/github-beta") {
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

  fromJSON(json: any) {
    const type: GithubNodeType = ((json.type: string): any);
    switch (type) {
      case "PULL_REQUEST":
        return new PullRequestPayload(json);
      case "PULL_REQUEST_COMMENT":
        return new PullRequestCommentPayload(json);
      default:
        // eslint-disable-next-line no-unused-expressions
        (type: empty);
        throw new Error("type: " + type);
    }
  }
}
```

## The `Graph` class

A graph is associated with a fixed set of plugins:

```javascript
type Plugins = {[pluginName: string]: PluginHandler<any, any>};
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
  static fromJSON(json: GraphJson, plugins: Plugins): Graph;

  addNode(np: NodePayload): this;
  addEdge(edge: Edge): this;

  removeNode(address: Address): this;
  removeEdge(address: Address): this;

  node(address: Address): ?Node<any, any>;
  edge(address: Address): ?Edge;
  nodeReference(address: Address): NodeReference /* see commentary below */;

  nodes(filter?: {|+type?: string|}): Iterator<Node<any, any>>;
  edges(filter?: {|+type?: string|}): Iterator<Edge>;

  static mergeConservative(Iterator<Graph>): Graph;

  // Some implementation details (but not all of them)…
  _nodes: {|+address: Address, +value: Node<any, any> | void|}[];
  _indexVersion: number;
  _internalNeighbors(
    number: number,
    options?: NeighborhoodOptions
  ): Iterator<NodeReference>;
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

Additionally, the proper semantics of `nodeReference` are not entirely
clear. There are four cases, depending on the `address` argument passed
to this method:

  1. The address corresponds to a node in the graph.
  2. The address corresponds to a node that does not appear in the
     graph, but has incident edges in the graph.
  3. The address corresponds to a phantom node—a node that does not
     exist in the graph and does not have incident edges, but still
     appears in `_nodes` due to a prior call to `removeNode`.
  4. The address has never been seen before.

Correspondingly:

  - The semantics for case (1) are clear.
  - It seems highly probable that, for case (2), we should return a
    non-null reference: otherwise, it is not clear how we can explore
    the structure around nodes that we know exist but do not have
    directly (e.g., to answer the question, “what other commits has the
    author of this commit authored?” when the “commit” notion comes from
    a different plugin than the “author” notion (say, a Git plugin and
    an OAuth plugin), and only the commit graph is loaded).
  - It also seems clear that cases (3) and (4) should have the same
    semantics as each other, but it is less clear what these should be.
  - In these cases, we could elect to either return `undefined` or to
    return a “null object”: an object for which `get()` returns `null`
    and `neighbors(_)` returns `[].values()`.
  - We should also ask—is the address required to be associated with a
    known plugin? If so, should we ask the plugin to give us a
    `NodeReference` instance specific to that plugin?
  - If we later learn about this node, can the formerly dangling
    reference come “back online”? Should it?
  - Does this mean that calling `nodeReference` can change the internal
    state of the graph? How does this impact the graph’s ability to
    compress its `_nodes`?

Some of these latter questions apply in case (2), too.

One resolution to, I think, all of these questions is to change the
`PluginHandler.createReference` method so that it does not accept a
`NodePayload`, or at least to make the payload optional. This has the
nice property that `PluginHandler<NR, NP>` has two simple functions: one
to enrich a base reference into an `NR`, and one to enrich a JSON blob
into an `NP`. I suspect that this is likely a good solution, but I am
interested to hear other opinions.

## Conclusion and next steps

This API encompasses an improvement to how nodes are handled. Clients
will usually work with either a `Node<NR, NP>` or a `NodeReference`
alone. There is still a bit of friction in that some methods are
inherently on the reference while others are on the porcelain, but this
is not actually a problem when the `Node<NR, NP>` is treated as a
package (not destructured): consider

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
type NeighborhoodOptionsV2 = {|
  +nodeFilter?: FilterV2,
  +edgeFilter?: FilterV2,
  +direction?: "IN" | "OUT" | "ANY",
|};

declare function neighborsV2(
  options?: NeighborhoodOptionsV2
): Iterator<NodeReference>;
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
declare function toCompat(compatInfo: CompatInfo, _: any): any;
declare function fromCompat(compatInfo: CompatInfo, _: any, _?: any): any;
```
