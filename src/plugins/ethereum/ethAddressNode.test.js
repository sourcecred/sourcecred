// @flow

import {nodeAddressForEthAddress} from "./ethAddressNode";
import {NodeAddress} from "../../core/graph";
import {parseAddress} from "./ethAddress";

describe("plugins/ethereum/ethAddressNode", () => {
  describe("nodeAddressForEthAddress", () => {
    const exampleAddress = "0x2Ccc7cD913677553766873483ed9eEDdB77A0Bb0";
    it("creates a valid node address when supplied an Eth Address", () => {
      const result = nodeAddressForEthAddress(parseAddress(exampleAddress));
      expect(result).toEqual(
        NodeAddress.fromParts(["sourcecred", "ethereum", exampleAddress])
      );
    });
  });
});
