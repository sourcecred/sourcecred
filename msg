Summary:

Test Plan:
On a test instance with the GitHub plugin pointing at the SourceCred
core repository, running the `load`, `graph`, `merge`, `credrank`
sequence yields an `output/credGraph.json`, and a spot-check of the
top-scoring users—

```
jq '
    .scores as $scores
    | [
        $scores | keys | .[]
        | {raw: ., parts: split("\u0000")}
        | select(.parts[2:5] == ["github", "USERLIKE", "USER"])
        | {who: .parts | join("/"), score: $scores[.raw]}
    ]
    | sort_by(-.score)[:10]
    | map({(.who): .score})
    | add
'
```

—is roughly consistent with what we’d expect.
