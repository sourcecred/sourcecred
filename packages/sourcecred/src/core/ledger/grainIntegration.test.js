// @flow

import {
  type GrainIntegrationFunction,
  executeGrainIntegration,
} from "./grainIntegration";
import {
  createUuidMock,
  createDateMock,
  createTestLedgerFixture,
  id1,
  id2,
  g,
  nng,
} from "./testUtils";
import * as uuid from "../../util/uuid";
import {buildCurrency} from "./currency";
import {parseAddress} from "../../plugins/ethereum/ethAddress";
import {diffLedger} from "./diffLedger";
import {Ledger} from "./ledger";
const allocationId1: uuid.Uuid = uuid.random();
const allocationId2: uuid.Uuid = uuid.random();
const uuidMock = createUuidMock();
const dateMock = createDateMock();
const {ledgerWithActiveIdentities} = createTestLedgerFixture(
  uuidMock,
  dateMock
);

describe("src/core/ledger/grainIntegration", () => {
  describe("executeGrainIntegration", () => {
    let ledger;
    let sink;
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
      policy: {
        policyType: "BALANCED",
        budget: nng("20"),
        numIntervalsLookback: 0,
      },
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
      ledger.enableIntegrationTracking();
      ledger.distributeGrain(distribution);
      sink = ledger.createIdentity("ORGANIZATION", "sink");
      ledger.activate(sink);
      ledger.setPayoutAddress(
        id1,
        parseAddress("0x0000000000000000000000000000000000000001"),
        currency.chainId
      );
      ledger.setPayoutAddress(
        id2,
        parseAddress("0x0000000000000000000000000000000000000002"),
        currency.chainId
      );
      ledger.setExternalCurrency(buildCurrency("BTC").chainId);
    });
    const getmockIntegration: (?boolean) => GrainIntegrationFunction = (
      returnTransfers = false,
      returnOutput = false
    ) => (distributions = [], _unused_config) => {
      const _ = currency;
      const transferResult = distributions.map(([payoutAddress, amount]) => ({
        payoutAddress,
        amount,
        memo: "hello transfer",
      }));
      const result = returnTransfers
        ? {transferredGrain: transferResult, outputFile: undefined}
        : {transferredGrain: [], outputFile: undefined};
      if (returnOutput)
        result.outputFile = {
          fileName: "testName.csv",
          content: "this is a result from a grain integration.",
        };
      return result;
    };
    const currency = buildCurrency("BTC");
    it("can execute GrainIntegration that doesn't update the ledger", () => {
      const ledgerSnapshot = ledger.serialize();
      const {ledger: newLedger} = executeGrainIntegration(
        ledger,
        getmockIntegration(),
        distribution,
        sink
      );
      const result = diffLedger(newLedger, Ledger.parse(ledgerSnapshot));
      expect(result).toEqual([
        {
          "action": {
            "id": "000000000000000000000A",
            "type": "MARK_DISTRIBUTION_EXECUTED",
          },
          "ledgerTimestamp": 11,
          "uuid": "000000000000000000012A",
          "version": "1",
        },
      ]);
    });
    it("doesn't transfer grain if processDistributions isn't set", () => {
      ledger.disableIntegrationTracking();
      const ledgerSnapshot = ledger.serialize();
      const {ledger: newLedger} = executeGrainIntegration(
        ledger,
        getmockIntegration(true),
        distribution,
        sink
      );
      const result = diffLedger(newLedger, Ledger.parse(ledgerSnapshot));
      expect(result).toEqual([]);
    });
    it("doesn't transfer grain if a accounting isn't enabled", () => {
      const ledgerSnapshot = ledger.serialize();
      ledger.disableAccounting();
      const {ledger: newLedger} = executeGrainIntegration(
        ledger,
        getmockIntegration(true),
        distribution,
        sink
      );
      const result = diffLedger(newLedger, Ledger.parse(ledgerSnapshot));
      expect(result).toContainEqual({
        "action": {
          "id": "000000000000000000000A",
          "type": "MARK_DISTRIBUTION_EXECUTED",
        },
        "ledgerTimestamp": 13,
        "uuid": "000000000000000000014A",
        "version": "1",
      });
    });
    it("doesn't transfer grain if a sink isn't set", () => {
      const ledgerSnapshot = ledger.serialize();
      const {ledger: newLedger} = executeGrainIntegration(
        ledger,
        getmockIntegration(true),
        distribution
      );
      const result = diffLedger(newLedger, Ledger.parse(ledgerSnapshot));
      expect(result).toEqual([
        {
          "action": {
            "id": "000000000000000000000A",
            "type": "MARK_DISTRIBUTION_EXECUTED",
          },
          "ledgerTimestamp": 11,
          "uuid": "000000000000000000012A",
          "version": "1",
        },
      ]);
    });
    it("does not mark a distribution as executed if Integration tracking is disabled", () => {
      const ledgerSnapshot = ledger.serialize();
      ledger.disableIntegrationTracking();
      const {ledger: newLedger} = executeGrainIntegration(
        ledger,
        getmockIntegration(),
        distribution,
        sink
      );
      const result = diffLedger(newLedger, Ledger.parse(ledgerSnapshot));
      expect(result).toEqual([
        {
          "action": {
            "type": "DISABLE_GRAIN_INTEGRATION",
          },
          "ledgerTimestamp": 11,
          "uuid": "000000000000000000012A",
          "version": "1",
        },
      ]);
    });
    it("updates the ledger when balances are returned by the integration", () => {
      const ledgerSnapshot = ledger.serialize();
      const {ledger: newLedger} = executeGrainIntegration(
        ledger,
        getmockIntegration(true),
        distribution,
        sink
      );
      const result = diffLedger(newLedger, Ledger.parse(ledgerSnapshot));
      expect(result).toEqual([
        {
          "action": {
            "id": "000000000000000000000A",
            "type": "MARK_DISTRIBUTION_EXECUTED",
          },
          "ledgerTimestamp": 11,
          "uuid": "000000000000000000012A",
          "version": "1",
        },
        {
          action: {
            from: "YVZhbGlkVXVpZEF0TGFzdA",
            to: "000000000000000000006A",
            amount: "13",
            memo: "Integrated Distribution: hello transfer",
            type: "TRANSFER_GRAIN",
          },
          version: "1",
          "ledgerTimestamp": 12,
          uuid: "000000000000000000013A",
        },
        {
          action: {
            from: "URgLrCxgvjHxtGJ9PgmckQ",
            to: "000000000000000000006A",
            amount: "17",
            memo: "Integrated Distribution: hello transfer",
            type: "TRANSFER_GRAIN",
          },
          version: "1",
          ledgerTimestamp: 13,
          uuid: "000000000000000000014A",
        },
      ]);
    });
  });
});
