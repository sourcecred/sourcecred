// @flow

import {type CreditorNode} from "./creditorNode";
import Store, {getDetails, toNodeEntry} from "./credNodeStore";
import {random as randomUuid} from "../../util/uuid";

describe("plugins/creditor/credNodeStore", () => {
  const tagId1 = randomUuid();
  const tagId2 = randomUuid();
  const baseNode: CreditorNode = {
    id: randomUuid(),
    tags: [tagId1, tagId2],
    title: "Implementing credNodes",
    description: "creating credNodes for use in the creditor",
    graphTimestamp: new Date("1/1/2000").getTime(),
    createdAt: new Date("12/1/2000").getTime(),
    mint: 0,
    parent: null,
  };

  const childNode: CreditorNode = {
    id: randomUuid(),
    tags: [tagId2],
    title: "Creating credNode type",
    description: "specifying credNodes to test the store",
    graphTimestamp: new Date("1/1/2000").getTime(),
    createdAt: new Date("11/1/2000").getTime(),
    mint: 20,
    parent: baseNode.id,
  };

  describe("adding nodes to store", () => {
    it("requires nodes to have expected members", () => {
      const store = new Store();
      const thunk = (badNode: Object) => () => store.set(badNode);

      const badNodes = [
        [{}, "Creditor Node UUID required"],
        [{id: randomUuid()}, "`tags` must be an array"],
        [
          {id: randomUuid(), tags: []},
          "`title` and `description` are required in Cred Nodes",
        ],
        [
          {
            id: randomUuid(),
            tags: [],
            title: "bad Node",
            description: "badDescription",
            createdAt: 0,
            graphTimestamp: 0,
          },
          "`createdAt` and `graphTimestamp` values must be non-zero",
        ],
      ];
      badNodes.forEach(([node, errorMsg]) =>
        expect(thunk(node)).toThrowError(errorMsg)
      );
    });
    it("can set and get valid nodes", () => {
      const store = new Store();
      const nextStore = store.set(baseNode);
      expect(nextStore).toEqual(store);
      const returnedBase = store.get(baseNode.id);
      expect(returnedBase).toEqual(baseNode);
    });
    it("returns null for nonexistent nodes", () => {
      const store = new Store();
      const badId = randomUuid();
      const result = store.get(badId);
      expect(result).toBeEmpty;
    });
  });
  describe("node interactions", () => {
    const store = new Store();
    describe("child-parent relationships", () => {
      it("cannot add node with nonexistent parent", () => {
        expect(() => store.set(childNode)).toThrowError(
          "cannot add node with nonexistent parent"
        );
      });
      it("can add child after parent", () => {
        store.set(baseNode);
        store.set(childNode);
      });
      it("can access parent from child ID", () => {
        const returnedNode = store.getParent(childNode.id);
        expect(returnedNode).toEqual(baseNode);
      });
      it("returns null when getting nonexistent parent", () => {
        const result = store.getParent(baseNode.id);
        expect(result).toBeEmpty;
      });
    });
    describe("tag references", () => {
      it("returns NodeDetails when querying nodes by tag IDs", () => {
        const baseDetails = getDetails(baseNode);
        const childDetails = getDetails(childNode);
        expect(store.referencingTag(tagId1)).toEqual([baseDetails]);
        expect(store.referencingTag(tagId2)).toEqual([
          baseDetails,
          childDetails,
        ]);
      });
      it("returns an empty array when unused tag is queried", () => {
        expect(store.referencingTag(randomUuid())).toEqual([]);
      });
    });
  });
  describe("exports", () => {
    const store = new Store().set(baseNode).set(childNode);
    it("returns an iterable on the values method call", () => {
      expect(Array.from(store.values())).toEqual([baseNode, childNode]);
    });
    it("returns nodes sorted on `createdAt` in ascending order when serialized", () => {
      //TODO replace jsonParse with comboParser
      expect(JSON.parse(store.serialize())).toEqual([
        toNodeEntry(childNode),
        toNodeEntry(baseNode),
      ]);
    });
  });
  it.todo("test non-empty constructor");
});
