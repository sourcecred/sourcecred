// @flow

import {Ledger} from "../core/ledger/ledger";
import * as uuid from "../util/uuid";
import {LedgerManager} from "./ledgerManager";
import type {LedgerLog} from "../core/ledger/ledger";
import * as G from "../core/ledger/grain";
import {createUuidMock} from "../core/ledger/testUtils";

describe("api/ledgerManager", () => {
  // Helper for constructing Grain values.
  const g = (s) => G.fromString(s);

  const {resetFakeUuid, setNextUuid} = createUuidMock();

  const id1 = uuid.fromString("YVZhbGlkVXVpZEF0TGFzdA");
  const id2 = uuid.fromString("URgLrCxgvjHxtGJ9PgmckQ");

  function ledgerWithIdentities() {
    resetFakeUuid();
    const ledger = new Ledger();
    setNextUuid(id1);
    ledger.createIdentity("USER", "steven");
    setNextUuid(id2);
    ledger.createIdentity("ORGANIZATION", "crystal-gems");
    return ledger;
  }

  const mockStorage = {
    read: jest.fn(() => Promise.resolve(new Ledger())),
    write: jest.fn((ledger: Ledger) => {
      setRemoteLedger(ledger);
      return Promise.resolve();
    }),
  };

  const setRemoteLedger = (remoteLedger: Ledger) => {
    mockStorage.read.mockImplementation(() =>
      Promise.resolve(Ledger.fromEventLog(remoteLedger.eventLog()))
    );
  };

  const createLedgerManager = (initLogs?: LedgerLog) => {
    return new LedgerManager({
      storage: mockStorage,
      initLogs,
    });
  };

  const allocation = {
    policy: {policyType: "IMMEDIATE", budget: g("15")},
    id: uuid.random(),
    receipts: [
      {amount: g("10"), id: id1},
      {amount: g("5"), id: id2},
    ],
  };

  const distribution = {
    credTimestamp: 1,
    allocations: [allocation],
    id: uuid.random(),
  };

  // fixture for testing sync conflicts. Remote Ledger contains an event that
  // the local ledger in the manager does not
  const syncEventsFixture = () => {
    const baseLedger = ledgerWithIdentities();
    baseLedger.activate(id1);
    baseLedger.activate(id2);
    baseLedger.distributeGrain(distribution);

    const baseEventLog = baseLedger.eventLog();
    const remoteLedger = Ledger.fromEventLog(baseEventLog);
    const manager = createLedgerManager(baseEventLog);

    remoteLedger.transferGrain({
      from: id1,
      to: id2,
      amount: g("6"),
      memo: "remote transfer",
    });
    setRemoteLedger(remoteLedger);

    return {manager, remoteLedger, baseEventLog};
  };

  it("should instantiate with an empty ledger", () => {
    const manager = createLedgerManager();
    expect(manager.ledger.eventLog()).toEqual([]);
  });

  it("should instantiate a new ledger with existing event logs", () => {
    const initLedger = ledgerWithIdentities();
    const manager = createLedgerManager(initLedger.eventLog());

    expect(manager.ledger.eventLog()).toEqual(initLedger.eventLog());
    expect(manager.ledger).not.toBe(initLedger);
  });

  describe("reloadLedger", () => {
    beforeEach(() => {
      mockStorage.read.mockClear();
      setRemoteLedger(new Ledger());
    });

    it("should load an empty remote ledger with empty local ledger", async () => {
      const manager = createLedgerManager();
      const res = await manager.reloadLedger();

      expect(res.error).toBe(null);
      expect(res.remoteChanges).toEqual([]);
      expect(res.localChanges).toEqual([]);
      expect(mockStorage.read).toBeCalledTimes(1);
    });

    it("should load events from remote ledger with an empty local ledger", async () => {
      const remoteLedger = ledgerWithIdentities();
      setRemoteLedger(remoteLedger);

      const manager = createLedgerManager();
      const res = await manager.reloadLedger();

      expect(res.error).toBe(null);
      expect(res.remoteChanges).toEqual(remoteLedger.eventLog());
      expect(res.localChanges).toEqual([]);
      expect(mockStorage.read).toBeCalledTimes(1);
      expect(manager.ledger).toEqual(remoteLedger);
    });

    it("should load an empty remote ledger while preserving local ledger changes", async () => {
      const localLedger = ledgerWithIdentities();

      const manager = createLedgerManager(localLedger.eventLog());
      const res = await manager.reloadLedger();

      expect(res.error).toBe(null);
      expect(res.remoteChanges).toEqual([]);
      expect(res.localChanges).toEqual(localLedger.eventLog());
    });

    it("should load a remote ledger with existing events while preserving local ledger changes", async () => {
      const remoteLedger = ledgerWithIdentities();
      setRemoteLedger(remoteLedger);

      const manager = createLedgerManager(remoteLedger.eventLog());
      manager.ledger.activate(id1);
      manager.ledger.activate(id2);

      const res = await manager.reloadLedger();

      const expectedLocalChanges = [
        {
          ledgerTimestamp: expect.anything(),
          uuid: expect.anything(),
          action: {type: "TOGGLE_ACTIVATION", identityId: id1},
          version: "1",
        },
        {
          ledgerTimestamp: expect.anything(),
          uuid: expect.anything(),
          action: {type: "TOGGLE_ACTIVATION", identityId: id2},
          version: "1",
        },
      ];

      expect(res.error).toBe(null);
      expect(res.remoteChanges).toEqual([]);
      expect(res.localChanges).toEqual(expectedLocalChanges);
      expect(manager.ledger.eventLog()).toEqual([
        ...remoteLedger.eventLog(),
        ...expectedLocalChanges,
      ]);
    });

    it("should replay local ledger events on top of new remote ledger events", async () => {
      const {manager, baseEventLog} = syncEventsFixture();

      manager.ledger.transferGrain({
        from: id1,
        to: id2,
        amount: g("4"),
        memo: "local transfer",
      });

      const expectedRemoteChanges = [
        {
          ledgerTimestamp: expect.anything(),
          uuid: expect.anything(),
          version: "1",
          action: {
            type: "TRANSFER_GRAIN",
            amount: "6",
            memo: "remote transfer",
            from: id1,
            to: id2,
          },
        },
      ];

      const expectedLocalChanges = [
        {
          ledgerTimestamp: expect.anything(),
          uuid: expect.anything(),
          version: "1",
          action: {
            type: "TRANSFER_GRAIN",
            amount: "4",
            memo: "local transfer",
            from: id1,
            to: id2,
          },
        },
      ];

      const res = await manager.reloadLedger();

      expect(res.error).toBe(null);
      expect(res.remoteChanges).toEqual(expectedRemoteChanges);

      expect(res.localChanges).toEqual(expectedLocalChanges);

      expect(manager.ledger.eventLog()).toEqual([
        ...baseEventLog,
        ...expectedRemoteChanges,
        ...expectedLocalChanges,
      ]);
    });

    it("should prevent replaying conflicting changes on remote ledger and return error", async () => {
      const {manager, baseEventLog} = syncEventsFixture();

      // User only has 4 grain in remote ledger, so transferring 5 grain should fail
      manager.ledger.transferGrain({
        from: id1,
        to: id2,
        amount: g("5"),
        memo: "local transfer",
      });

      const expectedRemoteChanges = [
        {
          ledgerTimestamp: expect.anything(),
          uuid: expect.anything(),
          version: "1",
          action: {
            type: "TRANSFER_GRAIN",
            amount: "6",
            memo: "remote transfer",
            from: id1,
            to: id2,
          },
        },
      ];

      const expectedLocalChanges = [
        {
          ledgerTimestamp: expect.anything(),
          uuid: expect.anything(),
          version: "1",
          action: {
            type: "TRANSFER_GRAIN",
            amount: "5",
            memo: "local transfer",
            from: id1,
            to: id2,
          },
        },
      ];

      const res = await manager.reloadLedger();

      expect(res.error).toBe(
        `Unable to apply local changes: transferGrain: ${id1} has insufficient balance for transfer: 5 > 4, resetting to remote ledger`
      );
      expect(res.remoteChanges).toEqual(expectedRemoteChanges);

      expect(res.localChanges).toEqual(expectedLocalChanges);

      expect(manager.ledger.eventLog()).toEqual([
        ...baseEventLog,
        ...expectedRemoteChanges,
      ]);
    });

    it("should discard any local changes that were successfully applied before a conflicting change", async () => {
      const {manager, baseEventLog} = syncEventsFixture();

      // Transferring 1g should succeed, leaving the user with 3g
      manager.ledger.transferGrain({
        from: id1,
        to: id2,
        amount: g("1"),
        memo: "local transfer 1g",
      });

      // Transferring 4g should fail since the user now only has 3
      manager.ledger.transferGrain({
        from: id1,
        to: id2,
        amount: g("4"),
        memo: "local transfer 4g",
      });

      const expectedRemoteChanges = [
        {
          ledgerTimestamp: expect.anything(),
          uuid: expect.anything(),
          version: "1",
          action: {
            type: "TRANSFER_GRAIN",
            amount: "6",
            memo: "remote transfer",
            from: id1,
            to: id2,
          },
        },
      ];

      const expectedConflictingLocalChanges = [
        {
          ledgerTimestamp: expect.anything(),
          uuid: expect.anything(),
          version: "1",
          action: {
            type: "TRANSFER_GRAIN",
            amount: "1",
            memo: "local transfer 1g",
            from: id1,
            to: id2,
          },
        },
        {
          ledgerTimestamp: expect.anything(),
          uuid: expect.anything(),
          version: "1",
          action: {
            type: "TRANSFER_GRAIN",
            amount: "4",
            memo: "local transfer 4g",
            from: id1,
            to: id2,
          },
        },
      ];

      const res = await manager.reloadLedger();

      expect(res.error).toBe(
        `Unable to apply local changes: transferGrain: ${id1} has insufficient balance for transfer: 4 > 3, resetting to remote ledger`
      );
      expect(res.remoteChanges).toEqual(expectedRemoteChanges);

      expect(res.localChanges).toEqual([...expectedConflictingLocalChanges]);

      expect(manager.ledger.eventLog()).toEqual([
        ...baseEventLog,
        ...expectedRemoteChanges,
      ]);
    });
  });

  describe("persist", () => {
    beforeEach(() => {
      mockStorage.read.mockClear();
      mockStorage.write.mockClear();
      setRemoteLedger(new Ledger());
    });

    it("should not write local changes if there is a conflict with remote ledger", async () => {
      const {manager} = syncEventsFixture();

      manager.ledger.transferGrain({
        from: id1,
        to: id2,
        amount: g("5"),
        memo: "local transfer",
      });

      const res = await manager.persist();

      expect(mockStorage.read).toBeCalledTimes(2);
      expect(mockStorage.write).not.toBeCalled();
      expect(res.error && res.error.indexOf("insufficient balance") > 0).toBe(
        true
      );
      expect(res.remoteChanges).toHaveLength(1);
      expect(res.localChanges).toHaveLength(1);
    });

    it("should write local changes to the ledger storage and reload the ledger", async () => {
      const {manager, remoteLedger} = syncEventsFixture();

      manager.ledger.transferGrain({
        from: id1,
        to: id2,
        amount: g("4"),
        memo: "local transfer",
      });

      const res = await manager.persist();

      expect(mockStorage.read).toBeCalledTimes(2);
      expect(mockStorage.write).toBeCalledTimes(1);
      expect(res.error).toBe(null);
      expect(res.remoteChanges).toEqual([]);
      expect(res.localChanges).toEqual([]);
      expect(manager.ledger.eventLog()).toEqual([
        ...remoteLedger.eventLog(),
        {
          ledgerTimestamp: expect.anything(),
          uuid: expect.anything(),
          version: "1",
          action: {
            type: "TRANSFER_GRAIN",
            amount: "4",
            memo: "local transfer",
            from: id1,
            to: id2,
          },
        },
      ]);
    });

    it("should return an error if the local changes are not present in the reloaded remote ledger", async () => {
      const {manager, remoteLedger} = syncEventsFixture();

      manager.ledger.transferGrain({
        from: id1,
        to: id2,
        amount: g("4"),
        memo: "local transfer",
      });

      // prevent update of remote ledger
      manager._storage.write.mockImplementationOnce(() => {
        return Promise.resolve();
      });

      const expectedLocalEvent = {
        ledgerTimestamp: expect.anything(),
        uuid: expect.anything(),
        version: "1",
        action: {
          type: "TRANSFER_GRAIN",
          amount: "4",
          memo: "local transfer",
          from: id1,
          to: id2,
        },
      };

      const res = await manager.persist();

      expect(mockStorage.read).toBeCalledTimes(2);
      expect(mockStorage.write).toBeCalledTimes(1);
      expect(res.error).toBe("Some local changes have not been persisted");
      expect(res.remoteChanges).toEqual([]);
      expect(res.localChanges).toEqual([expectedLocalEvent]);

      expect(manager.ledger.eventLog()).toEqual([
        ...remoteLedger.eventLog(),
        expectedLocalEvent,
      ]);
    });
  });
});
