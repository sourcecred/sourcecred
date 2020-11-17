// @flow

import {diffLedger} from "./diffLedger";
import * as uuid from "../../util/uuid";
import {Ledger} from "./ledger";
import {createUuidMock} from "./testUtils"; // for spy purposes

describe("core/ledger/diffLedger", () => {
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
    setNextUuid(aLedgerLog[aLedgerLog.length - 1].uuid);
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
