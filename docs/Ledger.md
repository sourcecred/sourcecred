<a name="Ledger"></a>

## Ledger
The Ledger is an append-only auditable data store which tracks
- Identities and what aliases they possess
- Identities' grain balances

Every time the ledger state is changed, a corresponding Action is added to
the ledger's action log. The ledger state may be serialized by saving the
action log, and then reconstructed by replaying the action log. The
corresponding methods are `actionLog` and `Ledger.fromActionLog`.

None of these methods are idempotent, since they all modify the Ledger state
on success by adding a new action to the log. Therefore, they will all fail
if they would not cause any change to the ledger's logical state, so as to
prevent the ledger from permanently accumulating no-op clutter in the log.

It's important that any API method that fails (e.g. trying to add a
conflicting identity) fails without mutating the ledger state; this way we avoid
ever getting the ledger in a corrupted state. To make this easier to test,
the test code uses deep equality testing on the ledger before/after
attempting illegal actions. To ensure that this testing works, we should
avoid adding any ledger state that can't be verified by deep equality
checking (e.g. don't store state in functions or closures that aren't
attached to the Ledger object).

Every Ledger action has a timestamp, and the Ledger's actions must always be
in timestamp-sorted order. Adding a new Action with a timestamp older than a
previous action is illegal.

 [ Github](https://github.com/sourcecred/sourcecred/blob/master/src/core/ledger/ledger.js)

**Kind**: global class  

* [Ledger](#Ledger)
    * _instance_
        * [.accounts()](#Ledger+accounts)
        * [.account()](#Ledger+account)
        * [.nameAvailable()](#Ledger+nameAvailable)
        * [.accountByAddress()](#Ledger+accountByAddress)
        * [.accountByName()](#Ledger+accountByName)
        * [.createIdentity()](#Ledger+createIdentity)
        * [.mergeIdentities()](#Ledger+mergeIdentities)
        * [.renameIdentity()](#Ledger+renameIdentity)
        * [.addAlias()](#Ledger+addAlias)
        * [.activate()](#Ledger+activate)
        * [.deactivate()](#Ledger+deactivate)
        * [.distributeGrain()](#Ledger+distributeGrain)
        * [.transferGrain()](#Ledger+transferGrain)
        * [.eventLog()](#Ledger+eventLog)
        * [.serialize()](#Ledger+serialize)
        * [.lastDistributionTimestamp()](#Ledger+lastDistributionTimestamp)
    * _static_
        * [.fromEventLog()](#Ledger.fromEventLog)
        * [.parse()](#Ledger.parse)

<a name="Ledger+accounts"></a>

### ledger.accounts()
Return all the Accounts in the ledger.

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger+account"></a>

### ledger.account()
Get the Account associated with a particular identity.

If the identity is not in the ledger, an error is thrown.

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger+nameAvailable"></a>

### ledger.nameAvailable()
Return whether the IdentityName in question is available.

For convenience in test code (and consistency with createIdentity and renameIdentity),
the name is provided as a string. If the string is not a valid name, an error will be
thrown.

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger+accountByAddress"></a>

### ledger.accountByAddress()
Return the account matching a given NodeAddress, if one exists.

Returns null if there is no account matching that address.

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger+accountByName"></a>

### ledger.accountByName()
Return the account with the given name, if one exists.

Returns null if there is no account matching that address.

Note: This is case sensitive.

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger+createIdentity"></a>

### ledger.createIdentity()
Create an account in the ledger.

This will reserve the identity's name, and its innate address.

This returns the newly created Identity's ID, so that the caller
store it for future reference.

Will fail if the name is not valid, or already taken.

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger+mergeIdentities"></a>

### ledger.mergeIdentities()
Merge two identities together.

One identity is considered the "base" and the other is the "target".
The target is absorbed into the base, meaning:
- Base gets the Grain balance, and lifetime paid amount added to its account.
- Base gets every alias that the target had.
- Base gets the target's own address as an alias.
- The target account is removed from the ledger.
- The target's login name is freed.

Attempting to merge an identity that doesn't exist, or to merge an identity into
itself, will error.

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger+renameIdentity"></a>

### ledger.renameIdentity()
Change a identity's name.

Will fail if no identity matches the identityId, or if the identity already has that
name, or if the identity's new name is claimed by another identity.

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger+addAlias"></a>

### ledger.addAlias()
Add an alias for a identity.

If that alias is associated with past Grain payments (because it
was unlinked from another identity), those past Grain payments will be
associated with the newly linked identity.

Will fail if the identity does not exist.
Will fail if the alias is already claimed by any identity.

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger+activate"></a>

### ledger.activate()
Activate an account, making it eligible to send and recieve Grain.

If the account is already active, this will no-op (without emitting any
event).

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger+deactivate"></a>

### ledger.deactivate()
Deactivate an account, making it ineligible to send or recieve Grain.

The account's Grain balance will remain untouched until it is reactivated.

If the account is already inactive, this will no-op (without emitting any
event).

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger+distributeGrain"></a>

### ledger.distributeGrain()
Canonicalize a Grain distribution in the ledger.

Fails if any of the recipients are not active.

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger+transferGrain"></a>

### ledger.transferGrain()
Transfer Grain from one account to another.

Fails if the sender does not have enough Grain, or if the Grain amount is
negative.
Fails if either the sender or the receipient have not been activated.
Self-transfers are supported.
An optional memo may be added.

Note: The arguments need to be bundled together in an object with named
keys, to avoid getting confused about which positional argument is `from`
and which one is `to`.

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger+eventLog"></a>

### ledger.eventLog()
Retrieve the log of all actions in the Ledger's history.

May be used to reconstruct the Ledger after serialization.

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger+serialize"></a>

### ledger.serialize()
Serialize the events as a JsonLog-style newline-delimited JSON
string.

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger+lastDistributionTimestamp"></a>

### ledger.lastDistributionTimestamp()
Return the cred-effective timestamp for the last Grain distribution.

We provide this because we may want to have a policy that issues one
distribution for each interval in the history of the project.

**Kind**: instance method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger.fromEventLog"></a>

### Ledger.fromEventLog()
Reconstruct a Ledger from a LedgerLog.

**Kind**: static method of [<code>Ledger</code>](#Ledger)  
<a name="Ledger.parse"></a>

### Ledger.parse()
Parse events serialized as a JsonLog-style newline-delimited JSON
string (e.g., by `serialize`).

**Kind**: static method of [<code>Ledger</code>](#Ledger)  
