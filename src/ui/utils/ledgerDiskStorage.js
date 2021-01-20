// @flow

import type {LedgerStorage} from "../../api/ledgerManager";
import {Ledger} from "../../core/ledger/ledger";

export const createLedgerDiskStorage = (
  ledgerFilePath: string
): LedgerStorage => ({
  read: async () => {
    const response = await fetch(ledgerFilePath);
    const rawLedger = await response.text();
    return Ledger.parse(rawLedger);
  },
  write: async (ledger) => {
    await fetch(ledgerFilePath, {
      headers: {
        Accept: "text/plain",
        "Content-Type": "text/plain",
      },
      method: "POST",
      body: ledger.serialize(),
    });
  },
});
