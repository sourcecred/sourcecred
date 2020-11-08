// @flow

import {Ledger} from "../core/ledger/ledger";
import * as uuid from "../util/uuid";
import {LedgerManager} from "./ledgerManager";
import type {LedgerLog} from "../core/ledger/ledger";
import * as G from "../core/ledger/grain"; // for spy purposes

describe("api/ledgerManager", () => {
  // Helper for constructing Grain values.
  const g = (s) => G.fromString(s);

  const randomMock = jest.spyOn(uuid, "random");

  let nextFakeUuidIndex = 0;
  function resetFakeUuid() {
    nextFakeUuidIndex = 0;
  }
  function nextFakeUuid(): uuid.Uuid {
    const uuidString = String(nextFakeUuidIndex).padStart(21, "0") + "A";
    nextFakeUuidIndex++;
    return uuid.fromString(uuidString);
  }

  randomMock.mockImplementation(nextFakeUuid);
  const id1 = uuid.fromString("YVZhbGlkVXVpZEF0TGFzdA");
  const id2 = uuid.fromString("URgLrCxgvjHxtGJ9PgmckQ");
  function setNextUuid(x: uuid.Uuid) {
    randomMock.mockImplementationOnce(() => x);
  }

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
    write: jest.fn(() => Promise.resolve()),
  };

  const setRemoteLedger = (remoteLedger: Ledger) => {
    mockStorage.read.mockImplementation(() => Promise.resolve(remoteLedger));
  };

  const createLedgerManager = (initLogs?: LedgerLog) => {
    return new LedgerManager({
      storage: mockStorage,
      initLogs,
    });
  };

  // fixture for testing sync conflicts
  const syncEventsFixture = () => {
    const baseLedger = ledgerWithIdentities();
    baseLedger.activate(id1);
    baseLedger.activate(id2);

    const baseEventLog = baseLedger.eventLog();
    const remoteLedger = Ledger.fromEventLog(baseEventLog);
    const manager = createLedgerManager(baseEventLog);

    remoteLedger._allocateGrain(id1, g("10"));
    manager.ledger._allocateGrain(id1, g("10"));

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
      expect(manager.ledger).toBe(remoteLedger);
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
  });
});
