// @flow

const HARDCODED_DECIMAL_PRECISION = 18;
const ZEROS = Array.from(Array(HARDCODED_DECIMAL_PRECISION + 1))
  .map(() => "0")
  .join("");

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
    const amountWithZerosPrefix = ZEROS + amount;
    const beforeDecimal = amountWithZerosPrefix.slice(
      0,
      amountWithZerosPrefix.length - HARDCODED_DECIMAL_PRECISION
    );
    const afterDecimal = amountWithZerosPrefix.slice(
      amountWithZerosPrefix.length - HARDCODED_DECIMAL_PRECISION
    );
    let formattedAmount = (beforeDecimal + "." + afterDecimal).replace(
      /^0+|0+$/g,
      ""
    );
    if (formattedAmount.startsWith("."))
      formattedAmount = "0" + formattedAmount;
    if (formattedAmount.endsWith(".")) formattedAmount = formattedAmount + "0";

    csvString += prefix + `${payoutAddress},${formattedAmount}\n`;
  }
  return csvString;
};
