// @flow

import {
  createUuidMock,
  createDateMock,
  createTestLedgerFixture,
} from "../../core/ledger/testUtils";
import {
  configureIntegrationCurrency,
  configureIntegrationTracking,
  configureLedgerAccounting,
} from "./grain";
import {buildCurrency} from "../../core/ledger/currency";
import {diffLedger} from "../../core/ledger/diffLedger";
import {parseAddress} from "../../plugins/ethereum/ethAddress";
import {Ledger} from "../../core/ledger/ledger";
const uuidMock = createUuidMock();
const dateMock = createDateMock();

const mockTokenAddress = parseAddress(
  "0x0000000000000000000000000000000000000001"
);
const {ledgerWithActiveIdentities} = createTestLedgerFixture(
  uuidMock,
  dateMock
);

describe("src/api/main/grain", () => {
  const protocolCurrency = buildCurrency("BTC");
  describe("configureIntegrationCurrency", () => {
    it("returns a ledger with a configured Protocol currency", () => {
      const ledger = ledgerWithActiveIdentities();
      const ledgerStart = ledger.serialize();
      const newLedger = configureIntegrationCurrency(ledger, protocolCurrency);
      const result = diffLedger(newLedger, Ledger.parse(ledgerStart));
      expect(result).toEqual([
        {
          "action": {
            "currency": {
              "chainId": "BTC",
              "type": "PROTOCOL",
            },
            "type": "SET_EXTERNAL_CURRENCY",
          },
          "ledgerTimestamp": 4,
          "uuid": "000000000000000000004A",
          "version": "1",
        },
      ]);
    });
    it("returns a ledger with a configured EVM currency", () => {
      const ledger = ledgerWithActiveIdentities();
      const ledgerStart = ledger.serialize();
      const evmCurrency = buildCurrency("1", mockTokenAddress);
      const newLedger = configureIntegrationCurrency(ledger, evmCurrency);
      const result = diffLedger(newLedger, Ledger.parse(ledgerStart));
      expect(result).toEqual([
        {
          "action": {
            "currency": {
              "chainId": "1",
              "tokenAddress": "0x0000000000000000000000000000000000000001",
              "type": "EVM",
            },
            "type": "SET_EXTERNAL_CURRENCY",
          },
          "ledgerTimestamp": 4,
          "uuid": "000000000000000000004A",
          "version": "1",
        },
      ]);
    });
    it("returns a ledger with no currency when a currency has been unset", () => {
      const ledger = ledgerWithActiveIdentities();
      const ledgerStart = ledger.serialize();
      const evmCurrency = buildCurrency("1", mockTokenAddress);
      configureIntegrationCurrency(ledger, evmCurrency);
      const newLedger = configureIntegrationCurrency(ledger);
      const result = diffLedger(newLedger, Ledger.parse(ledgerStart));
      expect(result).toEqual([
        {
          "action": {
            "currency": {
              "chainId": "1",
              "tokenAddress": "0x0000000000000000000000000000000000000001",
              "type": "EVM",
            },
            "type": "SET_EXTERNAL_CURRENCY",
          },
          "ledgerTimestamp": 4,
          "uuid": "000000000000000000004A",
          "version": "1",
        },
        {
          "action": {
            "type": "REMOVE_EXTERNAL_CURRENCY",
          },
          "ledgerTimestamp": 5,
          "uuid": "000000000000000000005A",
          "version": "1",
        },
      ]);
    });
  });
  describe("configureIntegrationTracking", () => {
    it("returns a ledger with Integration Tracking enabled", () => {
      const ledger = ledgerWithActiveIdentities();
      const ledgerStart = ledger.serialize();
      const newLedger = configureIntegrationTracking(ledger, true);
      const result = diffLedger(newLedger, Ledger.parse(ledgerStart));
      expect(result).toEqual([
        {
          "action": {
            "type": "ENABLE_GRAIN_INTEGRATION",
          },
          "ledgerTimestamp": 4,
          "uuid": "000000000000000000004A",
          "version": "1",
        },
      ]);
    });
    it("returns a ledger with Integration Tracking disabled", () => {
      const ledger = ledgerWithActiveIdentities();
      const ledgerStart = ledger.serialize();
      configureIntegrationTracking(ledger, true);
      const newLedger = configureIntegrationTracking(ledger, false);
      const result = diffLedger(newLedger, Ledger.parse(ledgerStart));
      expect(result).toEqual([
        {
          "action": {
            "type": "ENABLE_GRAIN_INTEGRATION",
          },
          "ledgerTimestamp": 4,
          "uuid": "000000000000000000004A",
          "version": "1",
        },
        {
          "action": {
            "type": "DISABLE_GRAIN_INTEGRATION",
          },
          "ledgerTimestamp": 5,
          "uuid": "000000000000000000005A",
          "version": "1",
        },
      ]);
    });
  });
  describe("configureLedgerAccounting", () => {
    it("can return a ledger with accounting disabled and later re-enabled", () => {
      const ledger = new Ledger();
      configureIntegrationCurrency(ledger, protocolCurrency);
      let ledgerSnapshot = ledger.serialize();
      let newLedger = configureLedgerAccounting(ledger, false);
      let result = diffLedger(newLedger, Ledger.parse(ledgerSnapshot));
      expect(result).toEqual([
        {
          "action": {
            "type": "DISABLE_ACCOUNTING",
          },
          "ledgerTimestamp": 7,
          "uuid": "000000000000000000007A",
          "version": "1",
        },
      ]);
      ledgerSnapshot = ledger.serialize();
      const updatedLedger = (newLedger = configureLedgerAccounting(
        ledger,
        true
      ));
      result = diffLedger(updatedLedger, Ledger.parse(ledgerSnapshot));
      expect(result).toEqual([
        {
          "action": {
            "type": "ENABLE_ACCOUNTING",
          },
          "ledgerTimestamp": 8,
          "uuid": "000000000000000000008A",
          "version": "1",
        },
      ]);
    });
  });
});
