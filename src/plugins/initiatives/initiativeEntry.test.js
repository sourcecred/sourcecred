// @flow

import {NodeAddress} from "../../core/graph";
import {createId, addressFromId} from "./initiative";
import {type InitiativeEntry} from "./initiativeEntry";

export const exampleInitiativeEntry = (): InitiativeEntry => ({
  id: "63fd31cd-1ea9-40e8-8f26-02917a1ca378",
  title: "Sample initiative",
  timestampMs: Date.parse("2020-01-08T22:01:57.766Z"),
  weight: {incomplete: 360, complete: 420},
  completed: false,
  champions: [NodeAddress.fromParts(["core", "pluginA", "user0"])],
  contributions: [{title: "Inline contrib"}],
  dependencies: [
    addressFromId(
      createId("INITIATIVE_FILE", "http://foo.bar/dir", "sample.json")
    ),
  ],
  references: [
    NodeAddress.fromParts([
      "core",
      "pluginB",
      "https://test.test/post",
      "Post2319",
    ]),
  ],
});
describe("plugins/initiatives/initiativeEntry", () => {
  it("creates an example entry file", () => {
    const entry = exampleInitiativeEntry();
    expect(entry);
  });
});
