// @flow

import {NodeAddress} from "../../core/graph";
import * as Timestamp from "../../util/timestamp";
import {createId, addressFromId} from "./initiative";
import {type InitiativesDirectory} from "./initiativesDirectory";
import {
  type InitiativeFile,
  fromJSON,
  toJSON,
  initiativeFileURL,
  initiativeFileId,
} from "./initiativeFile";

const exampleInitiativeFile = (): InitiativeFile => ({
  title: "Sample initiative",
  timestampIso: Timestamp.toISO(Date.parse("2020-01-08T22:01:57.766Z")),
  weight: {incomplete: 360, complete: 420},
  completed: false,
  champions: ["http://foo.bar/champ"],
  contributions: {
    urls: ["http://foo.bar/contrib"],
    entries: [{title: "Inline contrib"}],
  },
  dependencies: {
    urls: ["http://foo.bar/dep"],
    entries: [{title: "Inline dep"}],
  },
  references: {
    urls: ["http://foo.bar/ref"],
    entries: [{title: "Inline ref"}],
  },
});

describe("plugins/initiatives/initiativeFile", () => {
  describe("toJSON/fromJSON", () => {
    it("should handle an example round-trip", () => {
      // Given
      const initiativeFile = exampleInitiativeFile();

      // When
      const actual = fromJSON(toJSON(initiativeFile));

      // Then
      expect(actual).toEqual(initiativeFile);
    });
  });

  describe("initiativeFileURL", () => {
    it("should return null for a different prefix", () => {
      // Given
      const address = NodeAddress.fromParts(["foobar"]);

      // When
      const url = initiativeFileURL(address);

      // Then
      expect(url).toEqual(null);
    });

    it("should detect the correct prefix and create a URL", () => {
      // Given
      const remoteUrl = "http://foo.bar/dir";
      const fileName = "sample.json";
      const address = addressFromId(
        createId("INITIATIVE_FILE", remoteUrl, fileName)
      );

      // When
      const url = initiativeFileURL(address);

      // Then
      expect(url).toEqual(`${remoteUrl}/${fileName}`);
    });
  });

  describe("initiativeFileId", () => {
    it("should add the correct prefix to a remoteUrl and fileName", () => {
      // Given
      const dir: InitiativesDirectory = {
        localPath: "should-not-be-used",
        remoteUrl: "http://foo.bar/dir",
      };
      const fileName = "sample.json";

      // When
      const id = initiativeFileId(dir, fileName);

      // Then
      expect(id).toEqual(createId("INITIATIVE_FILE", dir.remoteUrl, fileName));
    });
  });
});
