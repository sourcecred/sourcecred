// @flow

import fs from "fs-extra";
import {join} from "path";

import {fromString as uuidFromString} from "../util/uuid";
import sortBy from "../util/sortBy";
import {loadFileWithDefault, loadJson} from "../util/disk";
import {fromJSON as credResultFromJson} from "../analysis/credResult";
import {CredView} from "../analysis/credView";
import {Ledger} from "../core/ledger/ledger";
import {applyDistributions} from "../core/ledger/applyDistributions";
import {computeCredAccounts} from "../core/ledger/credAccounts";
import {type GrainReceipt} from "../core/ledger/grainAllocation";
import {type Distribution} from "../core/ledger/distribution";
import stringify from "json-stable-stringify";
import * as G from "../core/ledger/grain";
import dedent from "../util/dedent";

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
  const ledger = Ledger.parse(
    await loadFileWithDefault(ledgerPath, () => new Ledger().serialize())
  );

  const distributions = applyDistributions(
    distributionPolicy,
    credView,
    ledger,
    +Date.now()
  );

  // Print MD table for each policy.
  distributions.map(({allocations}) =>
    allocations.map(({policy, receipts}) =>
      printAllocationMarkdownTable(
        receipts,
        ledger,
        `${policy.policyType} Grain Allocation`
      )
    )
  );

  printAllocationMarkdownTable(
    mergeReceipts(distributions),
    ledger,
    `Aggregate Grain Distribution`
  );

  await fs.writeFile(ledgerPath, ledger.serialize());

  const credAccounts = computeCredAccounts(ledger, credView);
  const accountsPath = join(baseDir, "output", "accounts.json");
  await fs.writeFile(accountsPath, stringify(credAccounts));

  return 0;
};

/**
 * Merge receipts under the same name into one.
 */
function mergeReceipts(
  distributions: $ReadOnlyArray<Distribution>
): $ReadOnlyArray<GrainReceipt> {
  const mergedBalances: {[string]: G.Grain} = {};
  for (const {allocations} of distributions) {
    for (const {receipts} of allocations) {
      for (const {amount, id} of receipts) {
        if (!mergedBalances[id.toString()]) {
          mergedBalances[id.toString()] = amount;
        } else {
          const existingBalance = mergedBalances[id.toString()];
          mergedBalances[id.toString()] = G.add(amount, existingBalance);
        }
      }
    }
  }

  return Object.keys(mergedBalances).map((id) => ({
    amount: mergedBalances[id],
    id: uuidFromString(id),
  }));
}

function printAllocationMarkdownTable(
  receipts: $ReadOnlyArray<GrainReceipt>,
  ledger: Ledger,
  title: string
) {
  const totalDistributed = receipts.reduce((sum, {amount}) => {
    return G.add(amount, sum);
  }, G.ZERO);

  console.log(`# ${title}`);
  console.log(
    `### ${G.toFloatRatio(totalDistributed, G.ONE).toFixed(0)} grain budget`
  );
  console.log();
  console.log(`| % | grain | name |`);
  console.log(`| --- | --- | --- |`);
  const sorted = sortBy(receipts, ({amount}) => -Number(amount));
  sorted.map((n) => console.log(row(n)));
  console.log();

  function row({amount, id}) {
    const percentage = 100 * G.toFloatRatio(amount, totalDistributed);

    // get alias from ledger
    const {name} = ledger.account(id).identity;
    return `| ${percentage.toFixed(2)}% | ${G.toFloatRatio(
      amount,
      G.ONE
    ).toFixed(2)} | ${name} |`;
  }
}

export const grainHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      usage: sourcecred grain

      Distribute Grain (or whatever currency this Cred instance is tracking)
      for Cred intervals in which Grain was not already distributed.

      When run, this will identify all the completed Cred intervals (currently, weeks)
      and find the latest Cred interval for which there was no Grain distribution.
      Then, it will distribute Grain for all of them, making a corresponding change
      to the Ledger. This could result in zero or more distributions, depending on how
      many recent Cred intervals had no corresponding Grain distribution.

      Grain is distributed based on the configuration in the config/grain.json
      file. The fields are as follows:

      immediatePerWeek: The amount of grain to distribute for activity in the most
      recent period. (value type: integer)

      balancedPerWeek: The amount of grain to distribute according to all-time cred
      scores. (value type: integer)

      maxSimultaneousDistributions: The maximum number of distributions to create in
      a single 'sourcecred grain' call if distributions have been missed. If set to
      1, then the command will create at most one distribution. If unset, defaults
      to Infinity.
      (value type: integer)
      `.trimRight()
  );
  return 0;
};

export default grainCommand;
