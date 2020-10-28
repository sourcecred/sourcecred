<a name="Assets"></a>

## Assets

Resolver for static assets (e.g., images, PDFs) and API data (e.g.,
the repository registry, plugin data). Any references to resources
should be resolved through this API.

**Kind**: global class

- [Assets](#Assets)
  - [new Assets()](#new_Assets_new)
  - [.resolve()](#Assets+resolve)

<a name="new_Assets_new"></a>

### new Assets()

Construct a resolver given a path to the root of the site. This can
be a relative path, like `../..`, or an absolute path, like `/`.

<a name="Assets+resolve"></a>

### assets.resolve()

Resolve a path as if the current directory and "/" both represent
the site root. For instance, "foo", "/foo", and "./foo" all
represent the same file. It is an error to specify a file that is
above the root, like "../bad".

**Kind**: instance method of [<code>Assets</code>](#Assets)
