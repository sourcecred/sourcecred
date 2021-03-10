// @flow

import {NodeAddress} from "../graph";
import {Ledger} from "./ledger";
import {newIdentity} from "../identity";
import {
  parseAddress as parseEthAddress,
  ETH_CURRENCY_ADDRESS,
} from "../../plugins/ethereum/ethAddress";
import {
  type EvmChainId,
  parseEvmChainId,
  protocolSymbolParser,
} from "./currency";
import * as G from "./grain";
import * as uuid from "../../util/uuid";
import {
  createUuidMock,
  failsWithoutMutation,
  createDateMock,
  createTestLedgerFixture,
  id1,
  id2,
  id3,
  g,
  nng,
} from "./testUtils";

const uuidMock = createUuidMock();
const dateMock = createDateMock();
const {
  identity1,
  identity2,
  ledgerWithIdentities,
  ledgerWithActiveIdentities,
} = createTestLedgerFixture(uuidMock, dateMock);
const {resetFakeUuid, setNextUuid} = uuidMock;
const {setFakeDate} = dateMock;

const allocationId1: uuid.Uuid = uuid.random();
const allocationId2: uuid.Uuid = uuid.random();
const allocationId3: uuid.Uuid = uuid.random();

describe("core/ledger/ledger", () => {
  const alias = {
    address: NodeAddress.fromParts(["alias"]),
    description: "alias",
  };

  describe("identity updates", () => {
    describe("createIdentity", () => {
      it("works", () => {
        setFakeDate(123);
        const l = new Ledger();
        const id = l.createIdentity("USER", "steven");
        const account = l.account(id);
        const identity = account.identity;
        expect(identity.subtype).toEqual("USER");
        expect(identity.name).toEqual("steven");
        expect(account).toEqual({
          paid: "0",
          balance: "0",
          active: false,
          payoutAddresses: new Map(),
          mergedIdentityIds: [identity.id],
          identity,
          allocationHistory: [],
        });
        expect(l.eventLog()).toEqual([
          {
            ledgerTimestamp: 123,
            uuid: expect.anything(),
            version: "1",
            action: {
              type: "CREATE_IDENTITY",
              identity,
            },
          },
        ]);
      });
      it("throws an error if the name is invalid", () => {
        const ledger = new Ledger();
        const thunk = () => ledger.createIdentity("USER", "foo bar");
        failsWithoutMutation(ledger, thunk, "invalid name");
      });
      it("throws an error if the name is taken", () => {
        const ledger = new Ledger();
        ledger.createIdentity("USER", "foo");
        const thunk = () => ledger.createIdentity("USER", "foo");
        failsWithoutMutation(ledger, thunk, "name already taken");
      });
      it("throws an error if the name would create a lowercased conflict", () => {
        const ledger = new Ledger();
        ledger.createIdentity("USER", "foo");
        const thunk = () => ledger.createIdentity("USER", "FOO");
        failsWithoutMutation(
          ledger,
          thunk,
          "already have same name with different capitalization"
        );
      });
      it("throws an error given an identity with aliases", () => {
        const ledger = new Ledger();
        let identity = newIdentity("USER", "foo");
        identity = {
          ...identity,
          aliases: [{address: NodeAddress.empty, description: "foo"}],
        };
        const action = {type: "CREATE_IDENTITY", identity};
        const thunk = () => ledger._createIdentity(action);
        expect(thunk).toThrowError("new identities may not have aliases");
      });
    });

    describe("renameIdentity", () => {
      it("works", () => {
        const ledger = new Ledger();
        setFakeDate(0);
        const id = ledger.createIdentity("USER", "foo");
        const initialIdentity = ledger.account(id).identity;
        setFakeDate(1);
        ledger.renameIdentity(id, "bar");
        const identity = ledger.account(id).identity;

        expect(identity).toEqual({
          id,
          name: "bar",
          subtype: "USER",
          address: initialIdentity.address,
          aliases: [],
        });

        expect(ledger.eventLog()).toEqual([
          {
            ledgerTimestamp: 0,
            uuid: expect.anything(),
            version: "1",
            action: {
              type: "CREATE_IDENTITY",
              identity: initialIdentity,
            },
          },
          {
            ledgerTimestamp: 1,
            uuid: expect.anything(),
            version: "1",
            action: {
              type: "RENAME_IDENTITY",
              newName: "bar",
              identityId: id,
            },
          },
        ]);
      });
      it("fails if the identity already has that name", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("USER", "foo");
        const thunk = () => ledger.renameIdentity(id, "foo");
        failsWithoutMutation(
          ledger,
          thunk,
          "renameIdentity: identity already has name"
        );
      });
      it("fails on nonexistent identity id", () => {
        const ledger = new Ledger();
        failsWithoutMutation(
          ledger,
          (l) => l.renameIdentity(uuid.random(), "bar"),
          "renameIdentity: no identity matches id"
        );
      });
      it("fails on name conflict", () => {
        const ledger = new Ledger();
        const fooId = ledger.createIdentity("USER", "foo");
        ledger.createIdentity("USER", "bar");
        const thunk = () => ledger.renameIdentity(fooId, "bar");
        failsWithoutMutation(
          ledger,
          thunk,
          "renameIdentity: conflict on name bar"
        );
      });
      it("fails on invalid name", () => {
        const ledger = new Ledger();
        const fooId = ledger.createIdentity("USER", "foo");
        const thunk = () => ledger.renameIdentity(fooId, "foo bar");
        failsWithoutMutation(ledger, thunk, "invalid name");
      });
      it("fails if it would create a lower-cased name conflict", () => {
        const ledger = new Ledger();
        const fooId = ledger.createIdentity("USER", "foo");
        ledger.createIdentity("USER", "case");
        const thunk = () => ledger.renameIdentity(fooId, "CASE");
        failsWithoutMutation(
          ledger,
          thunk,
          "already have same name with different capitalization"
        );
      });
      it("allows changing case on an existing name", () => {
        const ledger = new Ledger();
        const fooId = ledger.createIdentity("USER", "foo");
        ledger.renameIdentity(fooId, "FOO");
        const identity = ledger.account(fooId).identity;
        expect(identity.name).toEqual("FOO");
        // Verify that we keep the name in the lowercase set afterwards, too.
        const thunk = () => ledger.createIdentity("USER", "FoO");
        failsWithoutMutation(
          ledger,
          thunk,
          "same name with different capitalization"
        );
      });
      it("reserves the new name", () => {
        const ledger = new Ledger();
        const fooId = ledger.createIdentity("USER", "foo");
        ledger.renameIdentity(fooId, "bar");
        const thunk = () => ledger.createIdentity("USER", "bar");
        failsWithoutMutation(ledger, thunk, "name already taken");
      });
      it("unlocks the old lower-cased name", () => {
        const ledger = new Ledger();
        const fooId = ledger.createIdentity("USER", "FOO");
        ledger.renameIdentity(fooId, "BAR");
        ledger.createIdentity("USER", "foo");
      });
      it("reserves the new lower-cased name", () => {
        const ledger = new Ledger();
        const fooId = ledger.createIdentity("USER", "foo");
        ledger.renameIdentity(fooId, "BaR");
        const thunk = () => ledger.createIdentity("USER", "bar");
        failsWithoutMutation(
          ledger,
          thunk,
          "same name with different capitalization"
        );
      });
    });

    describe("changeIdentityType", () => {
      it("changes a USER identity type into a PROJECT identity type", () => {
        const ledger = new Ledger();
        setFakeDate(0);
        const id = ledger.createIdentity("USER", "foo");
        const initialIdentity = ledger.account(id).identity;
        setFakeDate(1);
        ledger.changeIdentityType(id, "PROJECT");
        const identity = ledger.account(id).identity;

        expect(identity).toEqual({
          id,
          name: "foo",
          subtype: "PROJECT",
          address: initialIdentity.address,
          aliases: [],
        });

        expect(ledger.eventLog()).toEqual([
          {
            ledgerTimestamp: 0,
            uuid: expect.anything(),
            version: "1",
            action: {
              type: "CREATE_IDENTITY",
              identity: initialIdentity,
            },
          },
          {
            ledgerTimestamp: 1,
            uuid: expect.anything(),
            version: "1",
            action: {
              type: "CHANGE_IDENTITY_TYPE",
              newType: "PROJECT",
              identityId: id,
            },
          },
        ]);
      });
      it("fails if the identity already has that type", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("USER", "foo");
        const thunk = () => ledger.changeIdentityType(id, "USER");
        failsWithoutMutation(
          ledger,
          thunk,
          "changeIdentityType: identity already has type USER"
        );
      });
      it("fails on nonexistent identity id", () => {
        const ledger = new Ledger();
        failsWithoutMutation(
          ledger,
          (l) => l.changeIdentityType(uuid.random(), "USER"),
          "changeIdentityType: no identity matches id"
        );
      });
      it("fails on invalid type", () => {
        const ledger = new Ledger();
        const fooId = ledger.createIdentity("USER", "foo");
        // $FlowExpectedError[prop-missing]
        const thunk = () => ledger.changeIdentityType(fooId, "ENTITY");
        failsWithoutMutation(ledger, thunk, "invalid type ENTITY");
      });
    });

    describe("addAlias", () => {
      it("works", () => {
        const ledger = new Ledger();
        setFakeDate(0);
        const id = ledger.createIdentity("USER", "foo");
        setFakeDate(1);
        ledger.addAlias(id, alias);
        const identity = ledger.account(id).identity;
        expect(identity.aliases).toEqual([alias]);
        expect(ledger.eventLog()).toEqual([
          {
            ledgerTimestamp: 0,
            uuid: expect.anything(),
            version: "1",
            action: {
              type: "CREATE_IDENTITY",
              identity: expect.anything(),
            },
          },
          {
            ledgerTimestamp: 1,
            uuid: expect.anything(),
            version: "1",
            action: {
              type: "ADD_ALIAS",
              identityId: id,
              alias: alias,
            },
          },
        ]);
      });
      it("adding multiple aliases with the same description is fine", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("USER", "foo");
        const a1 = {
          address: NodeAddress.fromParts(["1"]),
          description: "alias",
        };
        const a2 = {
          address: NodeAddress.fromParts(["2"]),
          description: "alias",
        };
        ledger.addAlias(id, a1);
        ledger.addAlias(id, a2);
        const identity = ledger.account(id).identity;
        expect(identity.aliases).toEqual([a1, a2]);
      });
      it("errors if there's no matching identity", () => {
        const ledger = new Ledger();
        failsWithoutMutation(
          ledger,
          (l) => l.addAlias(uuid.random(), alias),
          "no identity matches id"
        );
      });
      it("throws an error if the identity already has that alias", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("USER", "foo");
        ledger.addAlias(id, alias);
        const thunk = () => ledger.addAlias(id, alias);
        failsWithoutMutation(ledger, thunk, "identity already has alias");
      });
      it("errors if the address is another identity's alias", () => {
        const ledger = new Ledger();
        const id1 = ledger.createIdentity("USER", "foo");
        const id2 = ledger.createIdentity("USER", "bar");
        ledger.addAlias(id1, alias);
        const thunk = () => ledger.addAlias(id2, alias);
        failsWithoutMutation(
          ledger,
          thunk,
          `addAlias: alias ${NodeAddress.toString(alias.address)} already bound`
        );
      });
      it("errors if the address is the identity's innate address", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("USER", "foo");
        const identity = ledger.account(id).identity;
        const thunk = () =>
          ledger.addAlias(id, {address: identity.address, description: ""});
        failsWithoutMutation(
          ledger,
          thunk,
          `addAlias: alias ${NodeAddress.toString(
            identity.address
          )} already bound`
        );
      });
      it("errors if the address is another identity's innate address", () => {
        const ledger = ledgerWithIdentities();
        const thunk = () =>
          ledger.addAlias(id2, {address: identity1().address, description: ""});
        failsWithoutMutation(
          ledger,
          thunk,
          `addAlias: alias ${NodeAddress.toString(
            identity1().address
          )} already bound`
        );
      });
    });

    describe("mergeIdentitiy", () => {
      it("gives the target's grain balance and paid to the base account", () => {
        const ledger = ledgerWithActiveIdentities();
        ledger._allocateGrain({
          grainReceipt: {id: id1, amount: g("100")},
          allocationId: allocationId1,
          credTimestampMs: 0,
        });
        ledger._allocateGrain({
          grainReceipt: {id: id2, amount: g("10")},
          allocationId: allocationId2,
          credTimestampMs: 1,
        });
        ledger.mergeIdentities({base: id1, target: id2});

        const account = ledger.account(id1);
        expect(account.balance).toEqual(g("110"));
        expect(account.paid).toEqual(g("110"));
      });
      it("gives the target's allocation receipts to the base account and sorts chronologically", () => {
        const ledger = ledgerWithActiveIdentities();
        ledger._allocateGrain({
          grainReceipt: {id: id1, amount: g("100")},
          allocationId: allocationId1,
          credTimestampMs: 0,
        });
        ledger._allocateGrain({
          grainReceipt: {id: id1, amount: g("1")},
          allocationId: allocationId2,
          credTimestampMs: 2,
        });
        ledger._allocateGrain({
          grainReceipt: {id: id2, amount: g("10")},
          allocationId: allocationId3,
          credTimestampMs: 1,
        });
        ledger.mergeIdentities({base: id1, target: id2});

        const account = ledger.account(id1);
        expect(account.balance).toEqual(g("111"));
        expect(account.paid).toEqual(g("111"));
        expect(account.allocationHistory).toEqual([
          {
            grainReceipt: {id: id1, amount: g("100")},
            credTimestampMs: 0,
            allocationId: allocationId1,
          },
          {
            grainReceipt: {id: id2, amount: g("10")},
            credTimestampMs: 1,
            allocationId: allocationId3,
          },
          {
            grainReceipt: {id: id1, amount: g("1")},
            credTimestampMs: 2,
            allocationId: allocationId2,
          },
        ]);
      });
      it("gives the target's aliases to the base account", () => {
        const alias = {
          address: NodeAddress.fromParts(["1"]),
          description: "alias",
        };
        const ledger = ledgerWithActiveIdentities();
        ledger.addAlias(id2, alias);
        ledger.mergeIdentities({base: id1, target: id2});

        const aliases = ledger.account(id1).identity.aliases;
        expect(aliases).toContain(alias);
        expect(ledger._aliasAddressToIdentity.get(alias.address)).toEqual(id1);
      });
      it("base account keeps its aliases", () => {
        const alias = {
          address: NodeAddress.fromParts(["1"]),
          description: "alias",
        };
        const ledger = ledgerWithActiveIdentities();
        ledger.addAlias(id1, alias);
        ledger.mergeIdentities({base: id1, target: id2});

        const aliases = ledger.account(id1).identity.aliases;
        expect(aliases).toContain(alias);
      });
      it("gives the target's innate address as an alias to the base account", () => {
        const ledger = ledgerWithActiveIdentities();
        const target = ledger.account(id2).identity;
        ledger.mergeIdentities({base: id1, target: id2});
        const aliases = ledger.account(id1).identity.aliases;
        const expectedAlias = {
          address: target.address,
          description: `identity @${target.name} (id: ${target.id})`,
        };
        expect(aliases).toContainEqual(expectedAlias);
        expect(ledger._aliasAddressToIdentity.get(target.address)).toEqual(id1);
      });
      it("frees up the target's name", () => {
        const ledger = ledgerWithActiveIdentities();
        const target = ledger.account(id2).identity;
        ledger.mergeIdentities({base: id1, target: id2});
        ledger.createIdentity("USER", target.name);
      });
      it("frees up the target's login (for alternative capitalizations)", () => {
        const ledger = ledgerWithActiveIdentities();
        const target = ledger.account(id2).identity;
        ledger.mergeIdentities({base: id1, target: id2});
        expect(target.name).not.toEqual(target.name.toUpperCase());
        ledger.createIdentity("USER", target.name.toUpperCase());
      });
      it("target IdentityIDs point to correct base account after merges", () => {
        const ledger = ledgerWithActiveIdentities();
        ledger.mergeIdentities({base: id1, target: id2});
        expect(ledger.account(id2)).toEqual(ledger.account(id1));
        const newId = ledger.createIdentity("PROJECT", "SourceCred");
        ledger.activate(newId);
        ledger.mergeIdentities({base: newId, target: id1});
        expect(ledger.account(id2)).toEqual(ledger.account(id1));
        expect(ledger.account(newId)).toEqual(ledger.account(id1));
      });
      it("accounts() returns only the new account", () => {
        const ledger = ledgerWithActiveIdentities();
        ledger.mergeIdentities({base: id1, target: id2});
        expect(ledger.accounts()).toEqual([ledger.account(id1)]);
      });
      it("does not change the base account's login or id", () => {
        const ledger = ledgerWithActiveIdentities();
        const before = ledger.account(id1).identity;
        ledger.mergeIdentities({base: id1, target: id2});
        const after = ledger.account(id1).identity;
        expect(before.id).toEqual(after.id);
        expect(before.name).toEqual(after.name);
      });
      it("preserve's base account's payout address when a conflict exists", () => {
        const fullAddress = parseEthAddress(
          "0xffffffffffffffffffffffffffffffffffffffff"
        );
        const nearlyFullAddress = parseEthAddress(
          "0xfffffffffffffffffffffffffffffffffffffff0"
        );
        const ledger = ledgerWithActiveIdentities();
        ledger.setPayoutAddress(
          id1,
          fullAddress,
          parseEvmChainId("1"),
          ETH_CURRENCY_ADDRESS
        );
        ledger.setPayoutAddress(
          id2,
          nearlyFullAddress,
          parseEvmChainId("1"),
          ETH_CURRENCY_ADDRESS
        );
        const before = ledger.account(id1).payoutAddresses;
        ledger.mergeIdentities({base: id1, target: id2});
        const after = ledger.account(id1).payoutAddresses;
        expect(before).toEqual(after);
      });
      it("preserves target account's nonconflicting Payout Address", () => {
        const nearlyFullAddress = parseEthAddress(
          "0xfffffffffffffffffffffffffffffffffffffff0"
        );
        const ledger = ledgerWithActiveIdentities();
        ledger.setPayoutAddress(
          id2,
          nearlyFullAddress,
          parseEvmChainId("1"),
          ETH_CURRENCY_ADDRESS
        );
        const before = ledger.account(id2).payoutAddresses;
        ledger.mergeIdentities({base: id1, target: id2});
        const after = ledger.account(id1).payoutAddresses;
        expect(before).toEqual(after);
      });
      it("merges non-conflicting payoutAddresses", () => {
        const fullAddress = parseEthAddress(
          "0xffffffffffffffffffffffffffffffffffffffff"
        );
        const nearlyFullAddress = parseEthAddress(
          "0xfffffffffffffffffffffffffffffffffffffff0"
        );
        const ledger = ledgerWithActiveIdentities();
        ledger.setPayoutAddress(
          id1,
          fullAddress,
          parseEvmChainId("2"),
          ETH_CURRENCY_ADDRESS
        );
        ledger.setPayoutAddress(
          id2,
          nearlyFullAddress,
          parseEvmChainId("1"),
          ETH_CURRENCY_ADDRESS
        );
        const mergedAddresses = new Map([
          ...ledger.account(id2).payoutAddresses.entries(),
          ...ledger.account(id1).payoutAddresses.entries(),
        ]);
        ledger.mergeIdentities({base: id1, target: id2});
        const after = ledger.account(id1).payoutAddresses;
        expect(mergedAddresses).toEqual(after);
      });
      it("fails without mutation when base identity doesn't exist", () => {
        const ledger = ledgerWithActiveIdentities();
        failsWithoutMutation(
          ledger,
          () => ledger.mergeIdentities({base: id3, target: id1}),
          "no Account for identity"
        );
      });
      it("fails without mutation when target identity doesn't exist", () => {
        const ledger = ledgerWithActiveIdentities();
        failsWithoutMutation(
          ledger,
          () => ledger.mergeIdentities({base: id1, target: id3}),
          "no Account for identity"
        );
      });
      it("fails without mutation when the base and target are the same", () => {
        const ledger = ledgerWithActiveIdentities();
        failsWithoutMutation(
          ledger,
          () => ledger.mergeIdentities({base: id1, target: id1}),
          "tried to merge identity @steven with itself"
        );
      });
      it("does not change the activation status of the base account", () => {
        let ledger = ledgerWithIdentities();
        ledger.mergeIdentities({base: id1, target: id2});
        expect(ledger.account(id1).active).toBe(false);

        ledger = ledgerWithIdentities();
        ledger.activate(id1);
        ledger.mergeIdentities({base: id1, target: id2});
        expect(ledger.account(id1).active).toBe(true);
      });
      it("writes the correct event to the log", () => {
        const ledger = ledgerWithIdentities();
        const ledgerLength = ledger.eventLog().length;
        ledger.mergeIdentities({base: id1, target: id2});
        const events = ledger.eventLog();
        // Only one event should be added.
        expect(events).toHaveLength(ledgerLength + 1);
        const latest = events[events.length - 1];
        const action = latest.action;
        expect(action).toEqual({
          type: "MERGE_IDENTITIES",
          base: id1,
          target: id2,
        });
      });
    });

    describe("nameAvailable", () => {
      it("works through a sequence of name changes", () => {
        const ledger = new Ledger();
        // All names are available in empty ledger
        expect(ledger.nameAvailable("Foo")).toBe(true);

        // Once we add a name, alternative capitalizations become
        // unavailable.
        const id1 = ledger.createIdentity("USER", "Foo");
        expect(ledger.nameAvailable("Foo")).toBe(false);
        expect(ledger.nameAvailable("fOO")).toBe(false);

        // Rename frees up the original name, but reserves the new one.
        ledger.renameIdentity(id1, "bar");
        expect(ledger.nameAvailable("Foo")).toBe(true);
        expect(ledger.nameAvailable("fOO")).toBe(true);
        expect(ledger.nameAvailable("bar")).toBe(false);
        expect(ledger.nameAvailable("BAR")).toBe(false);

        // Now neither FOO nor BAR are available (in any
        // capitalizations)
        const id2 = ledger.createIdentity("USER", "foo");
        expect(ledger.nameAvailable("FOO")).toBe(false);
        expect(ledger.nameAvailable("BAR")).toBe(false);

        // Post merge, Foo gets freed up, but Bar is still reserved.
        ledger.mergeIdentities({base: id1, target: id2});
        expect(ledger.nameAvailable("FOO")).toBe(true);
        expect(ledger.nameAvailable("BAR")).toBe(false);
      });
      it("errors if given an invalid name", () => {
        const ledger = new Ledger();
        const thunk = () => ledger.nameAvailable("");
        expect(thunk).toThrow("invalid name");
      });
    });
  });

  describe("grain accounts", () => {
    it("unseen addresses don't have accounts", () => {
      const ledger = new Ledger();
      const thunk = () => ledger.account(id1);
      expect(thunk).toThrowError(`no Account for identity: ${id1}`);
      expect(ledger.accounts()).toEqual([]);
    });

    it("accounts may be activated", () => {
      const ledger = new Ledger();
      setNextUuid(id1);
      ledger.createIdentity("USER", "steven");
      ledger.activate(id1);
      expect(ledger.account(id1)).toEqual({
        identity: identity1(),
        paid: "0",
        balance: "0",
        active: true,
        allocationHistory: [],
        payoutAddresses: new Map(),
        mergedIdentityIds: [identity1().id],
      });
      expect(ledger.eventLog()).toEqual([
        expect.anything(),
        {
          ledgerTimestamp: expect.anything(),
          uuid: expect.anything(),
          action: {type: "TOGGLE_ACTIVATION", identityId: id1},
          version: "1",
        },
      ]);
    });
    it("accounts may be deactivated", () => {
      const ledger = new Ledger();
      setNextUuid(id1);
      ledger.createIdentity("USER", "steven");
      ledger.activate(id1);
      ledger.deactivate(id1);
      expect(ledger.account(id1)).toEqual({
        identity: identity1(),
        paid: "0",
        balance: "0",
        active: false,
        allocationHistory: [],
        payoutAddresses: new Map(),
        mergedIdentityIds: [identity1().id],
      });
      expect(ledger.eventLog()).toEqual([
        expect.anything(),
        {
          ledgerTimestamp: expect.anything(),
          uuid: expect.anything(),
          action: {type: "TOGGLE_ACTIVATION", identityId: id1},
          version: "1",
        },
        {
          ledgerTimestamp: expect.anything(),
          uuid: expect.anything(),
          action: {type: "TOGGLE_ACTIVATION", identityId: id1},
          version: "1",
        },
      ]);
    });
    it("deactivating an inactive account is a no-op", () => {
      const l1 = ledgerWithIdentities();
      const l2 = ledgerWithIdentities();
      l1.deactivate(id1);
      expect(l1).toEqual(l2);
    });
    it("activating an already-active account is a no-op", () => {
      function ex() {
        const ledger = ledgerWithIdentities();
        setFakeDate(3);
        ledger.activate(id1);
        return ledger;
      }
      const l1 = ex();
      const l2 = ex();
      l1.activate(id1);
      expect(l1).toEqual(l2);
    });
    it("activating a non-existent account throws an error", () => {
      const l = new Ledger();
      failsWithoutMutation(
        l,
        () => l.activate(id1),
        `identity ${id1} not found`
      );
    });
    it("deactivating a non-existent account throws an error", () => {
      const l = new Ledger();
      failsWithoutMutation(
        l,
        () => l.deactivate(id1),
        `identity ${id1} not found`
      );
    });
    it("an inactive account may hold onto a Grain balance", () => {
      const ledger = ledgerWithActiveIdentities();
      ledger._allocateGrain({
        grainReceipt: {id: id1, amount: g("50")},
        allocationId: allocationId1,
        credTimestampMs: 1,
      });
      ledger.deactivate(id1);
      expect(ledger.account(id1)).toEqual({
        identity: identity1(),
        paid: g("50"),
        balance: g("50"),
        active: false,
        allocationHistory: [
          {
            grainReceipt: {id: id1, amount: g("50")},
            credTimestampMs: 1,
            allocationId: allocationId1,
          },
        ],
        payoutAddresses: new Map(),
        mergedIdentityIds: [identity1().id],
      });
    });

    describe("accountByAddress", () => {
      it("returns null if no account matches the address", () => {
        const ledger = new Ledger();
        expect(ledger.accountByAddress(NodeAddress.empty)).toBe(null);
      });
      it("retrieves an account by innate address", () => {
        const ledger = ledgerWithIdentities();
        const account = ledger.account(id1);
        const address = account.identity.address;
        expect(ledger.accountByAddress(address)).toEqual(account);
      });
      it("retrieves an account by alias address", () => {
        const ledger = ledgerWithIdentities();
        ledger.addAlias(id1, alias);
        const account = ledger.account(id1);
        const address = alias.address;
        expect(ledger.accountByAddress(address)).toEqual(account);
      });
      it("after merge, retrieves an account by target's innate address", () => {
        const ledger = ledgerWithIdentities();
        const addr2 = ledger.account(id2).identity.address;
        ledger.mergeIdentities({base: id1, target: id2});
        const account = ledger.account(id1);
        expect(ledger.accountByAddress(addr2)).toBe(account);
      });
      it("after merge, retrieves an account by target's alias address", () => {
        const ledger = ledgerWithIdentities();
        ledger.addAlias(id2, alias);
        ledger.mergeIdentities({base: id1, target: id2});
        const account = ledger.account(id1);
        expect(ledger.accountByAddress(alias.address)).toBe(account);
      });
    });

    describe("accountByName", () => {
      it("returns null if no account matches the name", () => {
        const ledger = new Ledger();
        expect(ledger.accountByName("hmm")).toBe(null);
      });
      it("retrieves an account by that name", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("USER", "foo");
        const account = ledger.account(id);
        expect(ledger.accountByName("foo")).toEqual(account);
      });
      it("is case-sensitive", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("USER", "Foo");
        const account = ledger.account(id);
        expect(ledger.accountByName("Foo")).toEqual(account);
        expect(ledger.accountByName("foo")).toEqual(null);
      });
      it("respects renames", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("USER", "Foo");
        ledger.renameIdentity(id, "Bar");
        const account = ledger.account(id);
        expect(ledger.accountByName("Foo")).toEqual(null);
        expect(ledger.accountByName("Bar")).toEqual(account);
      });
      it("throws an error for invalid names", () => {
        const ledger = new Ledger();
        const invalid = "not a valid name";
        const thunk = () => ledger.accountByName(invalid);
        failsWithoutMutation(ledger, thunk, "invalid name");
      });
      it("returns null for accounts merged out of existence", () => {
        const ledger = new Ledger();
        const base = ledger.createIdentity("USER", "base");
        const target = ledger.createIdentity("USER", "target");
        ledger.mergeIdentities({base, target});
        expect(ledger.accountByName("target")).toEqual(null);
      });
    });

    describe("setPayoutAddress", () => {
      const ethAddress = parseEthAddress(
        "0x0000000000000000000000000000000000000000"
      );
      const fullAddress = parseEthAddress(
        "0xffffffffffffffffffffffffffffffffffffffff"
      );
      const evmChainId: EvmChainId = parseEvmChainId("1");

      const btcChainId = protocolSymbolParser.parseOrThrow("BTC");

      const evmId = {
        type: "EVM",
        chainId: evmChainId,
        tokenAddress: ethAddress,
      };
      const protocolId = {type: "PROTOCOL", chainId: btcChainId};

      const setupLedgerwithPayoutAddress = (): Ledger => {
        const ledger = ledgerWithIdentities();
        ledger.setPayoutAddress(id1, fullAddress, evmChainId, ethAddress);
        return ledger;
      };

      it("can set a payout address for an existing user", () => {
        const ledger = setupLedgerwithPayoutAddress();
        const account = ledger.account(id1);
        expect(account.payoutAddresses.get(JSON.stringify(evmId))).toBe(
          fullAddress
        );
      });
      it("can delete a payout address for an existing user", () => {
        const ledger = setupLedgerwithPayoutAddress();
        ledger.setPayoutAddress(id1, null, evmChainId, ethAddress);
        const account = ledger.account(id1);
        expect(account.payoutAddresses.get(evmId.toString())).toBe(undefined);
      });
      it("cannot set an address for a non-existent user", () => {
        const badId = uuid.random();
        const ledger = setupLedgerwithPayoutAddress();
        const thunk = () =>
          ledger.setPayoutAddress(badId, fullAddress, evmChainId, ethAddress);

        expect(thunk).toThrow(
          `setPayoutAddress: no identity matches id ${badId}`
        );
      });
      it("cannot set a payable address with an invalid EthAddress", () => {
        const ledger = setupLedgerwithPayoutAddress();
        const thunk = () =>
          // $FlowExpectedError[incompatible-call]
          ledger.setPayoutAddress(id1, "0x0", evmChainId, ethAddress);
        expect(thunk).toThrow("setPayoutAddress: invalid payout address: 0x0");
      });
      it("works with a non-EVM protocol Id", () => {
        const ledger = ledgerWithIdentities();
        ledger.setPayoutAddress(id1, fullAddress, btcChainId);
        const account = ledger.account(id1);
        expect(account.payoutAddresses.get(JSON.stringify(protocolId))).toBe(
          fullAddress
        );
      });
    });
  });

  describe("grain updates", () => {
    describe("distributeGrain", () => {
      describe("when the distribution is empty", () => {
        let ledger;
        const distribution = {
          credTimestamp: 1,
          allocations: [],
          id: uuid.random(),
        };

        beforeEach(() => {
          ledger = new Ledger();
          setFakeDate(2);
          ledger.distributeGrain(distribution);
        });

        it("should create an empty distribution event", () => {
          expect(ledger.accounts()).toEqual([]);
          expect(ledger.eventLog()).toEqual([
            {
              version: "1",
              ledgerTimestamp: 2,
              uuid: expect.anything(),
              action: {type: "DISTRIBUTE_GRAIN", distribution},
            },
          ]);
        });

        it("should record the empty distribution", () => {
          expect(ledger.distribution(distribution.id)).toEqual(distribution);
          expect(Array.from(ledger.allocations())).toEqual([]);
          expect(Array.from(ledger.distributions())).toEqual([distribution]);
        });
      });

      describe("when the distribution has a single allocation", () => {
        let ledger;
        const allocation = {
          policy: {
            policyType: "IMMEDIATE",
            budget: nng("10"),
            numIntervalsLookback: 1,
          },
          id: allocationId1,
          receipts: [
            {amount: g("3"), id: id1},
            {amount: g("7"), id: id2},
          ],
        };
        const distribution = {
          credTimestamp: 1,
          allocations: [allocation],
          id: uuid.random(),
        };

        beforeEach(() => {
          ledger = ledgerWithActiveIdentities();
          ledger.distributeGrain(distribution);
        });

        it("should record the payments in the accounts", () => {
          const ac1 = {
            identity: identity1(),
            balance: g("3"),
            paid: g("3"),
            active: true,
            payoutAddresses: new Map(),
            mergedIdentityIds: [identity1().id],
            allocationHistory: [
              {
                grainReceipt: {id: id1, amount: g("3")},
                credTimestampMs: 1,
                allocationId: allocationId1,
              },
            ],
          };
          const ac2 = {
            identity: identity2(),
            balance: g("7"),
            paid: g("7"),
            active: true,
            payoutAddresses: new Map(),
            mergedIdentityIds: [identity2().id],
            allocationHistory: [
              {
                grainReceipt: {id: id2, amount: g("7")},
                credTimestampMs: 1,
                allocationId: allocationId1,
              },
            ],
          };
          expect(ledger.accounts()).toEqual([ac1, ac2]);
        });

        it("should record the allocation and distribution", () => {
          expect(ledger.allocation(allocation.id)).toEqual(allocation);
          expect(ledger.distribution(distribution.id)).toEqual(distribution);
          expect(Array.from(ledger.allocations())).toEqual([allocation]);
          expect(Array.from(ledger.distributions())).toEqual([distribution]);
          expect(ledger.distributionByAllocationId(allocation.id)).toEqual(
            distribution
          );
        });
      });

      describe("when the distribution has multiple allocations", () => {
        let ledger;
        const allocation1 = {
          policy: {
            policyType: "IMMEDIATE",
            budget: nng("10"),
            numIntervalsLookback: 1,
          },
          id: allocationId1,
          receipts: [
            {amount: g("3"), id: id1},
            {amount: g("7"), id: id2},
          ],
        };
        const allocation2 = {
          id: allocationId2,
          policy: {policyType: "BALANCED", budget: nng("20")},
          receipts: [
            {amount: g("10"), id: id1},
            {amount: g("10"), id: id2},
          ],
        };
        const distribution = {
          credTimestamp: 1,
          allocations: [allocation1, allocation2],
          id: uuid.random(),
        };

        beforeEach(() => {
          ledger = ledgerWithActiveIdentities();
          ledger.distributeGrain(distribution);
        });

        it("should record the payments in the accounts", () => {
          const ac1 = {
            identity: identity1(),
            balance: g("13"),
            paid: g("13"),
            active: true,
            payoutAddresses: new Map(),
            mergedIdentityIds: [identity1().id],
            allocationHistory: [
              {
                grainReceipt: {id: id1, amount: g("3")},
                credTimestampMs: 1,
                allocationId: allocationId1,
              },
              {
                grainReceipt: {id: id1, amount: g("10")},
                credTimestampMs: 1,
                allocationId: allocationId2,
              },
            ],
          };
          const ac2 = {
            identity: identity2(),
            balance: g("17"),
            paid: g("17"),
            active: true,
            payoutAddresses: new Map(),
            mergedIdentityIds: [identity2().id],
            allocationHistory: [
              {
                grainReceipt: {id: id2, amount: g("7")},
                credTimestampMs: 1,
                allocationId: allocationId1,
              },
              {
                grainReceipt: {id: id2, amount: g("10")},
                credTimestampMs: 1,
                allocationId: allocationId2,
              },
            ],
          };
          expect(ledger.accounts()).toEqual([ac1, ac2]);
        });

        it("should record the allocations and distribution", () => {
          expect(ledger.allocation(allocation1.id)).toEqual(allocation1);
          expect(ledger.allocation(allocation2.id)).toEqual(allocation2);
          expect(ledger.distribution(distribution.id)).toEqual(distribution);
          expect(Array.from(ledger.allocations())).toEqual([
            allocation1,
            allocation2,
          ]);
          expect(Array.from(ledger.distributions())).toEqual([distribution]);
          expect(ledger.distributionByAllocationId(allocation1.id)).toEqual(
            distribution
          );
          expect(ledger.distributionByAllocationId(allocation2.id)).toEqual(
            distribution
          );
        });
      });

      describe("when there are multiple distributions", () => {
        let ledger;
        const allocation1 = {
          policy: {
            policyType: "IMMEDIATE",
            budget: nng("10"),
            numIntervalsLookback: 1,
          },
          id: allocationId1,
          receipts: [
            {amount: g("3"), id: id1},
            {amount: g("7"), id: id2},
          ],
        };
        const allocation2 = {
          id: allocationId2,
          policy: {policyType: "BALANCED", budget: nng("20")},
          receipts: [
            {amount: g("10"), id: id1},
            {amount: g("10"), id: id2},
          ],
        };
        const distribution1 = {
          credTimestamp: 1,
          allocations: [allocation1],
          id: uuid.random(),
        };
        const distribution2 = {
          credTimestamp: 2,
          allocations: [allocation2],
          id: uuid.random(),
        };

        beforeEach(() => {
          ledger = ledgerWithActiveIdentities();
          ledger.distributeGrain(distribution1);
          ledger.distributeGrain(distribution2);
        });

        it("should record the payments in the accounts", () => {
          const ac1 = {
            identity: identity1(),
            balance: g("13"),
            paid: g("13"),
            active: true,
            payoutAddresses: new Map(),
            mergedIdentityIds: [identity1().id],
            allocationHistory: [
              {
                grainReceipt: {id: id1, amount: g("3")},
                credTimestampMs: 1,
                allocationId: allocationId1,
              },
              {
                grainReceipt: {id: id1, amount: g("10")},
                credTimestampMs: 2,
                allocationId: allocationId2,
              },
            ],
          };
          const ac2 = {
            identity: identity2(),
            balance: g("17"),
            paid: g("17"),
            active: true,
            payoutAddresses: new Map(),
            mergedIdentityIds: [identity2().id],
            allocationHistory: [
              {
                grainReceipt: {id: id2, amount: g("7")},
                credTimestampMs: 1,
                allocationId: allocationId1,
              },
              {
                grainReceipt: {id: id2, amount: g("10")},
                credTimestampMs: 2,
                allocationId: allocationId2,
              },
            ],
          };
          expect(ledger.accounts()).toEqual([ac1, ac2]);
        });

        it("should record the allocations and distributions", () => {
          expect(ledger.allocation(allocation1.id)).toEqual(allocation1);
          expect(ledger.allocation(allocation2.id)).toEqual(allocation2);
          expect(ledger.distribution(distribution1.id)).toEqual(distribution1);
          expect(ledger.distribution(distribution2.id)).toEqual(distribution2);
          expect(Array.from(ledger.allocations())).toEqual([
            allocation1,
            allocation2,
          ]);
          expect(Array.from(ledger.distributions())).toEqual([
            distribution1,
            distribution2,
          ]);
          expect(ledger.distributionByAllocationId(allocation1.id)).toEqual(
            distribution1
          );
          expect(ledger.distributionByAllocationId(allocation2.id)).toEqual(
            distribution2
          );
        });
      });

      it("fails if any receipt has invalid id", () => {
        const ledger = ledgerWithActiveIdentities();
        const allocation = {
          policy: {
            policyType: "IMMEDIATE",
            budget: nng("7"),
            numIntervalsLookback: 1,
          },
          id: uuid.random(),
          receipts: [
            {id: id1, amount: g("3")},
            {id: id3, amount: g("4")},
          ],
        };
        const distribution = {
          credTimestamp: 1,
          id: uuid.random(),
          allocations: [allocation],
        };
        const thunk = () => ledger.distributeGrain(distribution);
        failsWithoutMutation(ledger, thunk, "invalid id");
      });
      it("fails if any receipt has invalid amount", () => {
        const ledger = ledgerWithActiveIdentities();
        const allocation = {
          policy: {
            policyType: "IMMEDIATE",
            budget: nng("7"),
            numIntervalsLookback: 1,
          },
          id: uuid.random(),
          receipts: [
            {id: id1, amount: g("3")},
            {id: id2, amount: G.fromString("-4")},
          ],
        };
        const distribution = {
          credTimestamp: 1,
          id: uuid.random(),
          allocations: [allocation],
        };
        const thunk = () => ledger.distributeGrain(distribution);
        failsWithoutMutation(ledger, thunk, "negative Grain amount");
      });
      it("fails if any receipt goes to inactive identity", () => {
        const ledger = ledgerWithIdentities();
        ledger.activate(id1);
        const allocation = {
          policy: {
            policyType: "IMMEDIATE",
            budget: nng("7"),
            numIntervalsLookback: 1,
          },
          id: uuid.random(),
          receipts: [
            {id: id1, amount: g("3")},
            {id: id2, amount: g("4")},
          ],
        };
        const distribution = {
          credTimestamp: 1,
          id: uuid.random(),
          allocations: [allocation],
        };
        const thunk = () => ledger.distributeGrain(distribution);
        failsWithoutMutation(ledger, thunk, "distribute to inactive account");
      });
      it("updates the last distribution timestamp", () => {
        const l = new Ledger();
        expect(l.lastDistributionTimestamp()).toEqual(-Infinity);
        l.distributeGrain({
          id: uuid.random(),
          allocations: [],
          credTimestamp: 100,
        });
        expect(l.lastDistributionTimestamp()).toEqual(100);
        l.distributeGrain({
          id: uuid.random(),
          allocations: [],
          credTimestamp: 50,
        });
        expect(l.lastDistributionTimestamp()).toEqual(100);
        l.distributeGrain({
          id: uuid.random(),
          allocations: [],
          credTimestamp: 102,
        });
        expect(l.lastDistributionTimestamp()).toEqual(102);
      });
      it("fails if the distribution doesn't parse", () => {
        const ledger = new Ledger();
        const distribution = {
          // Error: should be number
          credTimestamp: "1",
          allocations: [],
          id: uuid.random(),
        };
        setFakeDate(2);
        // $FlowExpectedError[incompatible-call]
        const thunk = () => ledger.distributeGrain(distribution);
        expect(thunk).toThrowError("invalid distribution");
      });
    });

    describe("transferGrain", () => {
      it("works in a simple legal case", () => {
        const ledger = ledgerWithActiveIdentities();
        ledger._allocateGrain({
          grainReceipt: {id: id1, amount: g("100")},
          allocationId: allocationId1,
          credTimestampMs: 1,
        });
        ledger._allocateGrain({
          grainReceipt: {id: id2, amount: g("5")},
          allocationId: allocationId2,
          credTimestampMs: 2,
        });
        setFakeDate(5);
        ledger.transferGrain({
          from: id1,
          to: id2,
          amount: g("80"),
          memo: "test",
        });
        const account1 = {
          identity: identity1(),
          paid: g("100"),
          balance: g("20"),
          active: true,
          allocationHistory: [
            {
              grainReceipt: {id: id1, amount: g("100")},
              credTimestampMs: 1,
              allocationId: allocationId1,
            },
          ],
          payoutAddresses: new Map(),
          mergedIdentityIds: [identity1().id],
        };
        const account2 = {
          identity: identity2(),
          paid: g("5"),
          balance: g("85"),
          active: true,
          allocationHistory: [
            {
              grainReceipt: {id: id2, amount: g("5")},
              credTimestampMs: 2,
              allocationId: allocationId2,
            },
          ],
          payoutAddresses: new Map(),
          mergedIdentityIds: [identity2().id],
        };
        expect(ledger.account(id1)).toEqual(account1);
        expect(ledger.account(id2)).toEqual(account2);
        expect(ledger.eventLog()).toEqual([
          // Two createIdentity actions we aren't interested in
          expect.anything(),
          expect.anything(),
          // Two toggle activation actions we aren't interested in
          expect.anything(),
          expect.anything(),
          {
            ledgerTimestamp: 5,
            uuid: expect.anything(),
            version: "1",
            action: {
              type: "TRANSFER_GRAIN",
              amount: "80",
              memo: "test",
              from: id1,
              to: id2,
            },
          },
        ]);
      });
      it("errors if the sender does not exist", () => {
        const ledger = ledgerWithActiveIdentities();
        const thunk = () =>
          ledger.transferGrain({
            to: id1,
            from: id3,
            amount: G.ZERO,
            memo: null,
          });
        failsWithoutMutation(ledger, thunk, `invalid sender: ${id3}`);
      });
      it("errors if the recipient does not exist", () => {
        const ledger = ledgerWithActiveIdentities();
        const thunk = () =>
          ledger.transferGrain({
            to: id3,
            from: id1,
            amount: G.ZERO,
            memo: null,
          });
        failsWithoutMutation(ledger, thunk, `invalid recipient: ${id3}`);
      });
      it("an account may transfer to itself", () => {
        const ledger = ledgerWithActiveIdentities();
        ledger._allocateGrain({
          grainReceipt: {id: id1, amount: g("2")},
          allocationId: allocationId1,
          credTimestampMs: 1,
        });
        ledger.transferGrain({
          from: id1,
          to: id1,
          amount: g("1"),
          memo: "test",
        });
        const account = {
          identity: identity1(),
          paid: g("2"),
          balance: g("2"),
          active: true,
          allocationHistory: [
            {
              grainReceipt: {id: id1, amount: g("2")},
              credTimestampMs: 1,
              allocationId: allocationId1,
            },
          ],
          payoutAddresses: new Map(),
          mergedIdentityIds: [identity1().id],
        };
        expect(ledger.account(id1)).toEqual(account);
      });
      it("an account may not be overdrawn", () => {
        const ledger = ledgerWithActiveIdentities();
        ledger._allocateGrain({
          grainReceipt: {id: id1, amount: g("2")},
          allocationId: allocationId1,
          credTimestampMs: 1,
        });
        const thunk = () =>
          ledger.transferGrain({
            from: id1,
            to: id2,
            amount: g("3"),
            memo: "test",
          });
        failsWithoutMutation(
          ledger,
          thunk,
          "insufficient balance for transfer"
        );
      });
      it("a negative transfer is illegal", () => {
        const ledger = ledgerWithActiveIdentities();
        const thunk = () =>
          ledger.transferGrain({
            from: id1,
            to: id2,
            amount: G.fromString("-3"),
            memo: "test",
          });
        failsWithoutMutation(
          ledger,
          thunk,
          "cannot transfer negative Grain amount"
        );
      });
      it("a transfer from an inactive account is illegal", () => {
        const ledger = ledgerWithIdentities();
        ledger.activate(id2);
        const thunk = () =>
          ledger.transferGrain({
            from: id1,
            to: id2,
            amount: g("3"),
            memo: "test",
          });
        failsWithoutMutation(ledger, thunk, "transfer from inactive account");
      });
      it("a transfer to an inactive account is illegal", () => {
        const ledger = ledgerWithIdentities();
        ledger.activate(id1);
        const thunk = () =>
          ledger.transferGrain({
            from: id1,
            to: id2,
            amount: g("3"),
            memo: "test",
          });
        failsWithoutMutation(ledger, thunk, "transfer to inactive account");
      });
    });
  });

  describe("distribution and allocation lookups", () => {
    it("allocation throws when an invalid ID is provided", () => {
      const ledger = new Ledger();
      const thunk = () => ledger.allocation(uuid.random());
      expect(thunk).toThrowError("no Allocation for id");
    });

    it("distribution throws when an invalid ID is provided", () => {
      const ledger = new Ledger();
      const thunk = () => ledger.distribution(uuid.random());
      expect(thunk).toThrowError("no Distribution for id");
    });

    it("distributionByAllocationId throws when an invalid ID is provided", () => {
      const ledger = new Ledger();
      const thunk = () => ledger.distributionByAllocationId(uuid.random());
      expect(thunk).toThrowError("no Distribution for allocation id");
    });
  });

  describe("timestamps", () => {
    it("out-of-order events are illegal", () => {
      const ledger = new Ledger();
      setFakeDate(3);
      ledger.createIdentity("USER", "foo");
      setFakeDate(2);
      const thunk = () => ledger.createIdentity("USER", "foo");
      failsWithoutMutation(ledger, thunk, "out-of-order timestamp");
    });
    it("non-numeric timestamps are illegal", () => {
      const ledger = new Ledger();
      for (const bad of [NaN, Infinity, -Infinity]) {
        setFakeDate(bad);
        const thunk = () => ledger.createIdentity("USER", "foo");
        failsWithoutMutation(ledger, thunk, "invalid timestamp");
      }
    });
    it("lastDistributionTimestamp returns -Infinity if there have not been any distributions", () => {
      // consider changing this behavior; see
      // https://github.com/sourcecred/sourcecred/issues/2744
      const ledger = new Ledger();
      expect(ledger.lastDistributionTimestamp()).toEqual(-Infinity);
    });
  });

  describe("uuids", () => {
    it("ledger events have uuids", () => {
      const ledger = new Ledger();
      resetFakeUuid();
      ledger.createIdentity("USER", "foo");
      const ev = ledger.eventLog()[0];
      expect(ev.uuid).toEqual("000000000000000000001A");
    });
  });

  describe("state reconstruction", () => {
    // This is a ledger which has had at least one of every
    // supported Action.
    function richLedger(): Ledger {
      const ledger = ledgerWithIdentities();
      setFakeDate(3);
      ledger.addAlias(id1, alias);

      const distributionId = uuid.fromString("f9xPz9YGH0PuBpPAg2824Q");
      const allocationId = uuid.fromString("yYNur0NEEkh7fMaUn6n9QQ");
      setFakeDate(4);
      ledger.activate(id1);
      setFakeDate(4);
      ledger.activate(id2);
      setFakeDate(4);
      ledger.distributeGrain({
        credTimestamp: 1,
        id: distributionId,
        allocations: [
          {
            id: allocationId,
            policy: {
              policyType: "IMMEDIATE",
              budget: nng("100"),
              numIntervalsLookback: 1,
            },
            receipts: [
              {id: id1, amount: g("50")},
              {id: id2, amount: g("50")},
            ],
          },
        ],
      });
      setFakeDate(5);
      ledger.transferGrain({
        from: id1,
        to: id2,
        amount: g("10"),
        memo: null,
      });

      setFakeDate(6);
      ledger.mergeIdentities({base: id1, target: id2});
      setFakeDate(7);
      ledger.changeIdentityType(id1, "PROJECT");
      return ledger;
    }
    it("fromEventLog with an empty action log results in an empty ledger", () => {
      const emptyLog = new Ledger().eventLog();
      expect(emptyLog).toEqual([]);
      expect(Ledger.fromEventLog(emptyLog)).toEqual(new Ledger());
    });
    it("eventLog and fromEventLog compose to identity", () => {
      const ledger = richLedger();
      expect(Ledger.fromEventLog(ledger.eventLog())).toEqual(ledger);
    });
    it("serialized LedgerLogs may be parsed", () => {
      const oldLedger = richLedger();
      const ledgerString = oldLedger.serialize();
      const newLedger = Ledger.parse(ledgerString);
      expect(newLedger).toEqual(oldLedger);
    });
    it("serialized ledger snapshots as expected", () => {
      expect(richLedger().serialize()).toMatchSnapshot();
    });
    it("eventLog is a separate copy from the ledger's underlying log", () => {
      const ledger = new Ledger();
      const log = ledger.eventLog();
      ledger.createIdentity("USER", "foo");
      // Ledger's own log mutated; retrieved log is static.
      expect(log).not.toEqual(ledger.eventLog());
    });
  });
});
