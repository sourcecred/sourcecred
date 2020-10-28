<a name="SqliteMirror"></a>

## SqliteMirror
Persists a local copy of data from a Discord Guild.
Implements create and read functionality.

Each Mirror instance is tied to a particular Guild. Trying to use a mirror
for multiple Discord Guilds is not permitted; use separate Mirrors.

Note that Mirror persists separate Tables for Users and Guild Members.
Members are distinguished by membership in the Guild. Non-Member
Discord Users can participate in a Guild's activity by leaving comments,
reactions, etc. In our model, Members have a property, User, which
represents a full User object. Because of this, we save the User in the
AddMember method.

**Kind**: global class  

* [SqliteMirror](#SqliteMirror)
    * [new SqliteMirror()](#new_SqliteMirror_new)
    * [.addMember()](#SqliteMirror+addMember)

<a name="new_SqliteMirror_new"></a>

### new SqliteMirror()
Construct a new SqliteMirror instance.

Takes a Database and GuildId.

<a name="SqliteMirror+addMember"></a>

### sqliteMirror.addMember()
Because a User is represented in a Member object, we save the User in
`addMember`.

**Kind**: instance method of [<code>SqliteMirror</code>](#SqliteMirror)  
