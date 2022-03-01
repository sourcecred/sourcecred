// @flow

import {findContributionsBySubkey} from "./scoredContribution.js";
import {type Contribution, type Expression} from "./contribution.js";
import {NodeAddress} from "../graph.js";

describe("core/credequate/scoredContribution", () => {
  const weightOperand0 = {
    key: ":key0:",
    subkey: ":subkey0:",
  };

  const weightOperand1 = {
    key: ":key1:",
    subkey: ":subkey1:",
  };
  const weightOperand2 = {
    key: ":key2:",
    subkey: ":subkey2:",
  };

  const weightOperand3 = {
    key: ":key3:",
    subkey: ":subkey3:",
  };
  const weightOperand4 = {
    key: ":key4:",
    subkey: ":subkey4:",
  };

  const weightOperand5 = {
    key: ":key5:",
    subkey: ":subkey5:",
  };

  const expression: Expression = {
    operator: "ADD",
    expressionOperands: [],
    description: "",
    weightOperands: [weightOperand0, weightOperand1],
  };

  const participants = [
    {
      id: NodeAddress.fromParts(["amrro"]),
      shares: [weightOperand2, weightOperand3],
    },
    {
      id: NodeAddress.fromParts(["thena"]),
      shares: [weightOperand4, weightOperand5],
    },
  ];

  const contribution: Contribution = {
    id: "one",
    plugin: "discord",
    type: "",
    timestampMs: 0,
    expression,
    participants,
  };

  it("should find contributions with matching expression's key & subkey", () => {
    const iter = findContributionsBySubkey(
      [contribution],
      expression.weightOperands[0].key,
      expression.weightOperands[0].subkey ?? ""
    );

    const contributions = Array.from(iter);
    expect(contributions).toEqual([contribution]);
  });

  it("should find contributions with matching participant's share's key & subkey", () => {
    const iter = findContributionsBySubkey(
      [contribution],
      contribution.participants[0].shares[0].key,
      contribution.participants[0].shares[0].subkey ?? ""
    );

    const contributions = Array.from(iter);
    expect(contributions).toEqual([contribution]);
  });

  it("shouldn't find any contributions", () => {
    const iter = findContributionsBySubkey([contribution], "channel", "abcd");

    const contributions = Array.from(iter);
    console.log(contributions);
    expect(contributions).toEqual([]);
  });
});
