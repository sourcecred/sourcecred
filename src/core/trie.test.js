// @flow

import {NodeTrie, EdgeTrie} from "./trie";
import {NodeAddress, EdgeAddress} from "./graph";

describe("core/trie", () => {
  describe("type safety", () => {
    it("NodeTrie and EdgeTrie are distinct", () => {
      // $FlowFixMe[incompatible-type]
      const _unused_trie: NodeTrie<number> = new EdgeTrie();
    });
    it("NodeTrie rejects edge addresses", () => {
      // $FlowFixMe[incompatible-call]
      expect(() => new NodeTrie().add(EdgeAddress.empty, 7)).toThrowError(
        "EdgeAddress"
      );
    });
    it("EdgeTrie rejects node addresses", () => {
      // $FlowFixMe[incompatible-call]
      expect(() => new EdgeTrie().add(NodeAddress.empty, 7)).toThrowError(
        "EdgeAddress"
      );
    });
    it("NodeTrie accepts node addresses", () => {
      new NodeTrie().add(NodeAddress.empty, 7);
    });
    it("EdgeTrie accepts edge addresses", () => {
      new EdgeTrie().add(EdgeAddress.empty, 7);
    });
  });

  const empty = NodeAddress.empty;
  const foo = NodeAddress.fromParts(["foo"]);
  const fooBar = NodeAddress.fromParts(["foo", "bar"]);
  const fooBarZod = NodeAddress.fromParts(["foo", "bar", "zod"]);

  it("get returns empty list if nothing added", () => {
    const x = new NodeTrie();
    expect(x.get(foo)).toHaveLength(0);
  });

  it("can match the empty address", () => {
    const x = new NodeTrie().add(empty, 5);
    expect(x.get(empty)).toEqual([5]);
  });

  it("can match non-empty address", () => {
    expect(new NodeTrie().add(foo, 3).get(foo)).toEqual([3]);
  });

  it("matches empty address when given non-empty key", () => {
    const x = new NodeTrie().add(empty, 5);
    expect(x.get(foo)).toEqual([5]);
  });

  it("can match a (non-empty) prefix", () => {
    const x = new NodeTrie().add(foo, 3);
    expect(x.get(fooBar)).toEqual([3]);
  });

  it("does not match node that contains key", () => {
    const x = new NodeTrie().add(fooBarZod, 3);
    expect(x.get(fooBar)).toHaveLength(0);
  });

  it("can return a match on empty and non-empty", () => {
    const x = new NodeTrie().add(empty, 1).add(foo, 2);
    expect(x.get(foo)).toEqual([1, 2]);
  });

  it("swapping the order of addition doesn't change results", () => {
    const x = new NodeTrie().add(foo, 2).add(empty, 1);
    expect(x.get(foo)).toEqual([1, 2]);
  });

  it("get isn't fazed by intermediary parts missing values", () => {
    const x = new NodeTrie().add(fooBar, 2).add(fooBarZod, 3).add(empty, 0);
    // note there is no "foo" node
    expect(x.get(fooBarZod)).toEqual([0, 2, 3]);
  });

  it("getLast gets the last available value", () => {
    const x = new NodeTrie().add(foo, 2).add(fooBar, 3).add(empty, 0);
    expect(x.getLast(fooBarZod)).toEqual(3);
  });

  it("getLast returns undefined if no value is available", () => {
    expect(new NodeTrie().getLast(foo)).toEqual(undefined);
  });

  it("overwriting a value is illegal", () => {
    expect(() =>
      new NodeTrie().add(foo, 3).add(empty, 1).add(foo, 4)
    ).toThrowError("overwrite");
  });

  it("null and undefined are legal values", () => {
    const x = new NodeTrie().add(foo, null).add(fooBar, undefined);
    expect(x.get(fooBarZod)).toEqual([null, undefined]);
  });
});
