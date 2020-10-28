<a name="JsonLog"></a>

## JsonLog
JsonLog tracks and serializes append-only logs of JSON values.

At its heart, it's basically a simple wrapper around an array, which
enforces the rule that items may be appended to it, but never removed.

It also provides serialization logic. We store the log as a
newline-delimited stream of JSON values, with a one-to-one correspondence
between POSIX lines and elements in the sequence. That is, the serialized
form of an element will never contain an embedded newline, and there are no
empty lines. JSON streams can be easily inspected and manipulatedwith tools
like `jq` as well as standard Unix filters, and can be stored and
transmitted efficiently in Git repositories thanks to packfiles and delta
compression.

Elements of a `JsonLog` are always parsed using a Combo.Parser, which
ensures type safety at runtime.

**Kind**: global class  
