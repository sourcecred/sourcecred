# SourceCred Identity Plugin

Unlike most other plugins, the Identity plugin does not add any new
contributions to the graph. Instead, it's goal is to combine different user
accounts into a single identity. For example, if a contributor has an account
on both GitHub and Discourse (potentially with different usernames on each),
the identity plugin can combine these two accounts into a single identity,
allowing SourceCred to properly compute the Cred for this identity.

The technical term for how we do such combining is a _contraction_. Which we'll
use for the rest of this document.

## Status and Caveats

The Identity plugin currently only applies to new WeightedGraphs and Cred
scores being generated. However, if you're using this data to distribute
Grain or other tokens, you may need to contract the identities again.

For example, someone might have received Grain in the past for their GitHub and
Discourse user respectively, creating 2 separate accounts in the Grain ledger.
After these GitHub and Discourse nodes were contracted to one identity node,
the ledger would now have 3 separate accounts. The GitHub and Discourse ones
holding past distributions, but no longer receiving more. And a new identity
one which will receive distributions going forward. Normally you'd want to
have just 1 account instead which holds all distributions including past ones.

Code-reviewed support for Grain built into SourceCred should handle this in
the future. But for now, requires the instance maintainer to handle Grain
account contraction.

## Configuration

Identities can be configured using the `project.json` file.
By adding entries to the the `identities` array.

Below is an example `project.json` file which defines two identities, "User-A"
and "User-B", contracting their respective GitHub and Discourse accounts.

```js
[
  {
    "type": "sourcecred/project",
    "version": "0.4.0",
  },
  {
    // The identities we should contract.
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

The `username` field allows you to choose a new username for the contracted
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

Here is a simplified illustration of how contracting works under the hood.

Note that contractions are done _after_ the plugins have created their
respective parts of the graph. But _before_ any Cred scores are calculated.

Let’s assume we have a user `abc`, who has both GitHub and Discourse accounts
which we want to contract.

The GitHub and Discourse plugins have mapped out the contributions, users and
edges as they exist on those services. Even though we merge this into a single
graph, the GitHub and Discourse contributions of the _same person_ are still
disconnected.

```
GitHub user @abc
├── authored Pull Request #123
└── authored Issue #456

Discourse user /u/abc
├── authored Post /t/123/1
└── authored Post /t/123/2
```

Using the information from the project file, the plugin creates a new Identity
node and removes the alias nodes.

```
Identity @abc

[REMOVED]
├── authored Pull Request #123
└── authored Issue #456

[REMOVED]
├── authored Post /t/123/1
└── authored Post /t/123/2
```

Then the edges that were connected to the alias nodes are connected to the new
identity node instead.

```
Identity @abc
├── authored Pull Request #123
├── authored Issue #456
├── authored Post /t/123/1
└── authored Post /t/123/2
```

The disconnect between the GitHub and Discourse service is now gone. If we now
run the SourceCred algorithm, user `@abc`'s Cred will flow to a single node and
produce a much more accurate Cred score than before.
