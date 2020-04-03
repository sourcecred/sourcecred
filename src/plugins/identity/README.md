# SourceCred Identity Plugin

This folder contains the Identity plugin. Unlike most other plugins, the
Identity plugin does not add any new contributions to the graph. Instead, it
allows collapsing different user accounts together into a shared 'identity'
node.

To see why this is valuable, imagine that a contributor has an account on both
GitHub and Discourse (potentially with a different username on each service).
We would like to combine these two identities together, so that we can
represent that user's combined cred properly. The Identity plugin enables this.

## Status and Caveats

The Identity plugin currently only applies to new (Weighted)Graphs and Cred
scores being generated. When including historical Graphs/Cred scores, for
example to distribute Grain, you may need to contract the identities again.
This can be tricky to do correctly, as they may have already received Grain
on their GitHub/Discourse addresses before contraction.

Code-reviewed support for Grain built into SourceCred should handle this in
the future. But for now, requires the instance maintainer to handle Grain
account contraction.

## Configuration

Identities can be configured using the `project.json` file.
By adding entries to the the `identities` array.

As an example of what this would look like:

```js
[
  {
    "type": "sourcecred/project",
    "version": "0.4.0",
  },
  {
    // The identities we should collapse.
    "identities": [
      {
        "username": "User-A",
        "aliases": ["github/user-a", "discourse/user-a"],
      },
      {
        "username": "User-B",
        "aliases": ["github/user-b", "discourse/user-b"],
      },
    ],

    "id": "@example-project",
    "discourseServer": {
      // ...
    },
    "repoIds": [
      // ...
    ],
  },
]
```

### Username

The `username` field allows you to choose a new username for the collapsed
identity.

It's case-sensitive, must be _unique in this project_ and can contain `A-Z`,
`a-z`, `0-9`, `-` or `_` as valid characters.

For display purposes the username is prefixed with an `@`.
If a username is prefixed with `@` in the project file, it will be ignored.
Meaning `"username": "User-A"` and `"username": "@User-A"` are equivalent.

### Aliases

Aliases are strings with a format of: `{plugin}/{user ID for this plugin}`
Currently supported plugins are:

| Plugin    | Example alias            | Notes                                                              |
|:----------|:-------------------------|:-------------------------------------------------------------------|
| GitHub    | `github/example-user`    | A user account on GitHub's platform.                               |
| Discourse | `discourse/example-user` | A user account on the Discourse server configured in this project. |

## How a contraction works

Firstly, contractions are done _after_ the plugins have created their respective
parts of the graph. But _before_ any Cred scores are calculated.

The GitHub and Discourse plugins create edges for their respective user nodes
before contraction:

```
GitHub user @abc
├── authored Pull Request #123
└── authored Issue #456

Discourse user /u/abc
├── authored Post /t/123/1
└── authored Post /t/123/2
```

A new node is created, representing the Identity, with the username
provided in the project file. While removing the alias nodes.

```
Identity @abc

[REMOVED]
├── authored Pull Request #123
└── authored Issue #456

[REMOVED]
├── authored Post /t/123/1
└── authored Post /t/123/2
```

And we connect the edges to the new identity node.

```
Identity @abc
├── authored Pull Request #123
├── authored Issue #456
├── authored Post /t/123/1
└── authored Post /t/123/2
```

Now we're ready to calculate Cred scores.

### Reference detection

Plugins often support reference detection. This analyses a URL found in a piece
of content, to create a reference edge in the graph. The "detection" here means
to find out, whether the URL we found represents a node in the graph or not.

There isn't currently a URL scheme which represents an identity.

But because reference detection is done _before_ contraction, this means we can
use the URL for any of the aliases, and they'll point to the same identity.
For example:

- `https://github.com/abc`
- `https://example.discourse/u/abc`

These are effectively equivalent in this example, both creating edges to
`Identity @abc`.
