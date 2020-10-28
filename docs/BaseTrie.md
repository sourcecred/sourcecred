<a name="BaseTrie"></a>

## BaseTrie
**Kind**: global class  

* [BaseTrie](#BaseTrie)
    * [new BaseTrie()](#new_BaseTrie_new)
    * [.add()](#BaseTrie+add)
    * [.get()](#BaseTrie+get)
    * [.getLast()](#BaseTrie+getLast)

<a name="new_BaseTrie_new"></a>

### new BaseTrie()
Create an empty trie backed by the given address module.

<a name="BaseTrie+add"></a>

### baseTrie.add()
Add key `k` to this trie with value `v`. Return `this`.

**Kind**: instance method of [<code>BaseTrie</code>](#BaseTrie)  
<a name="BaseTrie+get"></a>

### baseTrie.get()
Get the values in this trie along the path to `k`.

More specifically, this method has the following observable
behavior. Let `inits` be the list of all prefixes of `k`, ordered
by length (shortest to longest). Observe that the length of `inits`
is `n + 1`, where `n` is the number of parts of `k`; `inits` begins
with the empty address and ends with `k` itself. Initialize the
result to an empty array. For each prefix `p` in `inits`, if `p`
was added to this trie with value `v`, then append `v` to
`result`. Return `result`.

**Kind**: instance method of [<code>BaseTrie</code>](#BaseTrie)  
<a name="BaseTrie+getLast"></a>

### baseTrie.getLast()
Get the last stored value `v` in the path to key `k`.
Returns undefined if no value is available.

**Kind**: instance method of [<code>BaseTrie</code>](#BaseTrie)  
