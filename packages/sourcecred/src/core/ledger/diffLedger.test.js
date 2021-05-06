// @flow

import {diffLedger} from "./diffLedger";
import {Ledger} from "./ledger";
import {id1, id2, createTestLedgerFixture, createUuidMock} from "./testUtils";

const uuidMock = createUuidMock();
const {ledgerWithIdentities} = createTestLedgerFixture(uuidMock);

describe("core/ledger/diffLedger", () => {
  it("should handle the empty case", () => {
    const a = new Ledger();
    const b = new Ledger();

    expect(diffLedger(a, b)).toEqual([]);
  });

  it("should return all events from a if b is empty", () => {
    const a = ledgerWithIdentities();
    const b = new Ledger();

    expect(diffLedger(a, b)).toEqual(a.eventLog());
  });

  it("should return an empty array if a is empty and b has events", () => {
    const a = new Ledger();
    const b = ledgerWithIdentities();

    expect(diffLedger(a, b)).toEqual([]);
  });

  it("should return only the events in a that dont exist in b", () => {
    const b = ledgerWithIdentities();

    const a = Ledger.fromEventLog(b.eventLog());
    a.activate(id1);
    a.activate(id2);

    const id1ActivationEvent = {
      ledgerTimestamp: expect.anything(),
      uuid: expect.anything(),
      action: {type: "TOGGLE_ACTIVATION", identityId: id1},
      version: "1",
    };

    const id2ActivationEvent = {
      ledgerTimestamp: expect.anything(),
      uuid: expect.anything(),
      action: {type: "TOGGLE_ACTIVATION", identityId: id2},
      version: "1",
    };
    expect(diffLedger(a, b)).toEqual([id1ActivationEvent, id2ActivationEvent]);

    const aLedgerLog = a.eventLog();

    // Create a duplicate event out-of-order in b to test if it gets filtered
    uuidMock.setNextUuid(aLedgerLog[aLedgerLog.length - 1].uuid);
    b.activate(id2);

    // Create a new event in b to test if it gets ignored
    b.createIdentity("USER", "bob");

    expect(diffLedger(a, b)).toEqual([
      {
        ledgerTimestamp: expect.anything(),
        uuid: expect.anything(),
        action: {type: "TOGGLE_ACTIVATION", identityId: id1},
        version: "1",
      },
    ]);
  });
});
