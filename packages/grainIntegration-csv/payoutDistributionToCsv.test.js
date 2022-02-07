// @flow
const payoutDistributionToCsv = require("./distributionToCsv");
describe("payoutDistributionToCsv", () => {
  it("serializes entries into a csv when gnosis config is absent", () => {
    const mockDistributions = [
      ["abc", "123"],
      ["def", "456"],
    ];
    const result = payoutDistributionToCsv(mockDistributions, {
      currency: { tokenAddress: "0x1234" },
      integration: undefined,
    });
    expect(result).toBe(`abc,123\ndef,456\n`);
  });
  it("serializes entries into a csv with gnosis prefix", () => {
    const mockDistributions = [
      ["abc", "123"],
      ["def", "456"],
    ];
    const result = payoutDistributionToCsv(mockDistributions, {
      currency: { tokenAddress: "0x1234" },
      integration: { gnosis: true },
    });
    expect(result).toBe(`erc20,0x1234,abc,123\nerc20,0x1234,def,456\n`);
  });
  it("serializes entries into a csv with gnosis prefix when the tokenAddress is absent", () => {
    const mockDistributions = [
      ["abc", "123"],
      ["def", "456"],
    ];
    const result = payoutDistributionToCsv(mockDistributions, {
      currency: {},
      integration: { gnosis: true },
    });
    expect(result).toBe(`erc20,,abc,123\nerc20,,def,456\n`);
  });
  it("returns an empty string when receiving an empty array", () => {
    const result = payoutDistributionToCsv([], {
      currency: { tokenAddress: "0x1234" },
      integration: undefined,
    });
    expect(result).toBe("");
  });
});
