<a name="MappedReferenceDetector"></a>

## MappedReferenceDetector

A reference detector which uses a pregenerated `Map<URL, NodeAddressT>` as a
lookup table.

Note: this is sensitive to canonicalization issues because it's based on string
comparisons. For example:

- "http://foo.bar/123" != "http://foo.bar/123#chapter-2"
- "http://foo.bar/?a=1&b=2" != "http://foo.bar/?b=2&a=1"
- "http://foo.bar/space+bar" != "http://foo.bar/space%20bar"

**Kind**: global class
