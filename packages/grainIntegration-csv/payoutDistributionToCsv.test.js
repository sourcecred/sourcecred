// @flow
const payoutDistributionToCsv = require("./distributionToCsv");
describe("payoutDistributionToCsv", () => {
  it("serializes entries into a csv when gnosis config is absent", () => {
    const mockDistributions = [
      ["abc", "99123456789012345678"],
      ["def", "456"],
      ["lol", "1000000000000000000"],
    ];
    const result = payoutDistributionToCsv(mockDistributions, {
      currency: { tokenAddress: "0x1234" },
      integration: undefined,
    });
    expect(result).toBe(`abc,99.123456789012345678\ndef,0.000000000000000456\nlol,1.0\n`);
  });
  it("serializes entries into a csv with gnosis prefix", () => {
    const mockDistributions = [
      ["abc", "99123456789012345678"],
      ["def", "456"],
      ["lol", "1000000000000000000"],
    ];
    const result = payoutDistributionToCsv(mockDistributions, {
      currency: { tokenAddress: "0x1234" },
      integration: { gnosis: true },
    });
    expect(result).toBe(`erc20,0x1234,abc,99.123456789012345678\nerc20,0x1234,def,0.000000000000000456\nerc20,0x1234,lol,1.0\n`);
  });
  it("serializes entries into a csv with gnosis prefix when the tokenAddress is absent", () => {
    const mockDistributions = [
      ["abc", "99123456789012345678"],
      ["def", "456"],
      ["lol", "1000000000000000000"],
    ];
    const result = payoutDistributionToCsv(mockDistributions, {
      currency: {},
      integration: { gnosis: true },
    });
    expect(result).toBe(`erc20,,abc,99.123456789012345678\nerc20,,def,0.000000000000000456\nerc20,,lol,1.0\n`);
  });
  it("returns an empty string when receiving an empty array", () => {
    const result = payoutDistributionToCsv([], {
      currency: { tokenAddress: "0x1234" },
      integration: undefined,
    });
    expect(result).toBe("");
  });
});
