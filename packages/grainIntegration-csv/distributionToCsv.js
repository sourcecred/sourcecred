// @flow

/*:: type PayoutDistributions = $ReadOnlyArray<[string, string]>;*/
/*:: type IntegrationConfig = {
  currency: {tokenAddress?: string},
  integration: ?Object,
};;*/
module.exports = function payoutDistributionToCsv(
  payoutDistributions /*: PayoutDistributions*/,
  config /*: IntegrationConfig*/
) /*: string*/ {
  let prefix = "";
  if (config.integration && config.integration.gnosis)
    prefix = "erc20," + (config.currency.tokenAddress || "") + ",";
  let csvString = "";
  for (const [payoutAddress, amount] of payoutDistributions) {
    csvString += prefix + `${payoutAddress},${amount}\n`;
  }
  return csvString;
};
