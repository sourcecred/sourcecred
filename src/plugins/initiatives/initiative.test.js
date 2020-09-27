// @flow

import {NodeAddress} from "../../core/graph";
import {createId, addressFromId} from "./initiative";

describe("plugins/initiatives/initiative", () => {
  describe("createId", () => {
    it("should require a subtype as first argument", () => {
      // $FlowExpectedError[incompatible-call]
      createId();
    });

    it("should require at least one ID component as second argument", () => {
      // $FlowExpectedError[incompatible-call]
      createId("SUBTYPE");
    });

    it("should work given at least a subtype and one ID component", () => {
      const id = createId("SUBTYPE", "123");
      expect(id).toEqual(["SUBTYPE", "123"]);
    });

    it("should work with an arbitrary number of ID components", () => {
      const id = createId("SUBTYPE", "123", "456", "789");
      expect(id).toEqual(["SUBTYPE", "123", "456", "789"]);
    });
  });

  describe("addressFromId", () => {
    it("should add the correct prefix to an InitiativeId", () => {
      // Given
      const id = createId("EXAMPLE", "123");

      // When
      const address = addressFromId(id);

      // Then
      expect(address).toEqual(
        NodeAddress.fromParts([
          "sourcecred",
          "initiatives",
          "initiative",
          "EXAMPLE",
          "123",
        ])
      );
    });
  });
});
