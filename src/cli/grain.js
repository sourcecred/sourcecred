// @flow

import fs from "fs-extra";
import {join} from "path";
import {loadJson, loadJsonWithDefault} from "../util/disk";
import {fromJSON as credResultFromJson} from "../analysis/credResult";
import {CredView} from "../analysis/credView";
import {Ledger, parser as ledgerParser} from "../ledger/ledger";
import {applyDistributions} from "../ledger/applyDistributions";
import {computeCredAccounts} from "../analysis/credAccounts";
import stringify from "json-stable-stringify";
import * as G from "../ledger/grain";

import * as GrainConfig from "../api/grainConfig";
import type {Command} from "./command";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const grainCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    return die(std, "usage: sourcecred grain");
  }

  const baseDir = process.cwd();
  const grainConfigPath = join(baseDir, "config", "grain.json");
  const grainConfig = await loadJson(grainConfigPath, GrainConfig.parser);
  const distributionPolicy = GrainConfig.toDistributionPolicy(grainConfig);

  const credResultPath = join(baseDir, "output", "credResult.json");
  const credResultJson = JSON.parse(await fs.readFile(credResultPath));
  const credResult = credResultFromJson(credResultJson);
  const credView = new CredView(credResult);

  const ledgerPath = join(baseDir, "data", "ledger.json");
  const ledger = await loadJsonWithDefault(
    ledgerPath,
    ledgerParser,
    () => new Ledger()
  );

  const distributions = applyDistributions(
    distributionPolicy,
    credView,
    ledger
  );

  let totalDistributed = G.ZERO;
  const recipientIdentities = new Set();
  for (const {allocations} of distributions) {
    for (const {receipts} of allocations) {
      for (const {amount, id} of receipts) {
        totalDistributed = G.add(amount, totalDistributed);
        recipientIdentities.add(id);
      }
    }
  }

  console.log(
    `Distributed ${G.format(totalDistributed)} to ${
      recipientIdentities.size
    } identities in ${distributions.length} distributions`
  );

  await fs.writeFile(ledgerPath, ledger.serialize());

  const credAccounts = computeCredAccounts(ledger, credView);
  const accountsPath = join(baseDir, "output", "accounts.json");
  await fs.writeFile(accountsPath, stringify(credAccounts));

  return 0;
};

export default grainCommand;
