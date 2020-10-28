<a name="Mirror"></a>

## Mirror

Mirrors data from the Discourse API into a local sqlite db.

This class allows us to persist a local copy of data from a Discourse
instance. We have it for reasons similar to why we have a GraphQL mirror for
GitHub; it allows us to avoid re-doing expensive IO every time we re-load
SourceCred. It also gives us robustness in the face of network failures (we
can keep however much we downloaded until the fault).

As implemented, the Mirror will never update already-downloaded content,
meaning it will not catch edits or deletions. As such, it's advisable to
replace the cache periodically (perhaps once a week or month). We may
implement automatic cache invalidation in the future.

Each Mirror instance is tied to a particular server. Trying to use a mirror
for multiple Discourse servers is not permitted; use separate Mirrors.

**Kind**: global class  
<a name="new_Mirror_new"></a>

### new Mirror()

Construct a new Mirror instance.

Takes a Database, which may be a pre-existing Mirror database. The
provided DiscourseInterface will be used to retrieve new data from Discourse.

A serverUrl is required so that we can ensure that this Mirror is only storing
data from a particular Discourse server.
