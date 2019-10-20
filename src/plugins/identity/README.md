# SourceCred Identity Plugin

This folder contains the Identity plugin. Unlike most other plugins, the
Identity plugin does not add any new contributions to the graph. Instead, it
allows collapsing different user accounts together into a shared 'identity'
node.

To see why this is valuable, imagine that a contributor has an account on both
GitHub and Discourse (potentially with a different username on each service).
We would like to combine these two identities together, so that we can
represent that user's combined cred properly. The Identity plugin enables this.

Specifically, the instance maintainer can provide a (locally unique) username
for the user, along with a list of aliases the user is known by, e.g.
`github/username` and `discourse/other_username`. The aliases are simple string
representations, that are intended to be easy to maintain by hand in a
configuration file. Then, the identity plugin will provide a list of
`NodeContraction`s that can be used by `Graph.contractNodes` to combine the
user identities as described.
