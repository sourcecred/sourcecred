<a name="MemoryCacheProvider"></a>

## MemoryCacheProvider

An in-memory CacheProvider.

Using the same ID's will produce the same cache, however data will be lost when
the process exits, or references to the MemoryCacheProvider are deleted.

Useful for tests or less I/O intense commands which should run in isolation.

**Kind**: global class  
<a name="MemoryCacheProvider+database"></a>

### memoryCacheProvider.database()

Returns a Database handle associated with this `id`,
an existing Database from the cache _may_ be provided.

Note: the exact Database object may be shared within the process.

**Kind**: instance method of [<code>MemoryCacheProvider</code>](#MemoryCacheProvider)
