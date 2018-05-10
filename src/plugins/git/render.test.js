// @flow

import type {
  CommitNodePayload,
  BlobNodePayload,
  TreeNodePayload,
  TreeEntryNodePayload,
  SubmoduleCommitPayload,
} from "./types";
import type {Node} from "../../core/graph";
import {Graph} from "../../core/graph";
import {_makeAddress, commitAddress} from "./address";
import {nodeDescription} from "./render";
import {submoduleCommitId, treeEntryId} from "./types";

describe("nodeDescription", () => {
  it("describes commits", () => {
    const node: Node<CommitNodePayload> = {
      address: commitAddress("cafebabe"),
      payload: (({}: any): {||}),
    };
    expect(nodeDescription(new Graph().addNode(node), node.address)).toEqual(
      "commit cafebabe"
    );
  });

  it("describes trees", () => {
    const node: Node<TreeNodePayload> = {
      address: _makeAddress("TREE", "deadbeef"),
      payload: (({}: any): {||}),
    };
    expect(nodeDescription(new Graph().addNode(node), node.address)).toEqual(
      "tree deadbeef"
    );
  });

  it("describes blobs", () => {
    const node: Node<BlobNodePayload> = {
      address: _makeAddress("BLOB", "01010101"),
      payload: (({}: any): {||}),
    };
    expect(nodeDescription(new Graph().addNode(node), node.address)).toEqual(
      "blob 01010101"
    );
  });

  it("describes submodule commits", () => {
    const hash = "15615651";
    const url = "https://github.com/sourcecred/example-git-submodule.git";
    const node: Node<SubmoduleCommitPayload> = {
      address: _makeAddress("SUBMODULE_COMMIT", submoduleCommitId(hash, url)),
      payload: {hash, url},
    };
    expect(nodeDescription(new Graph().addNode(node), node.address)).toEqual(
      `submodule commit ${hash} in ${url}`
    );
  });

  it("describes tree entries", () => {
    const tree = "76476476323";
    const name = "healing";
    const node: Node<TreeEntryNodePayload> = {
      address: _makeAddress("TREE_ENTRY", treeEntryId(tree, name)),
      payload: {name},
    };
    expect(nodeDescription(new Graph().addNode(node), node.address)).toEqual(
      `entry ${tree}:${name}`
    );
  });
});
