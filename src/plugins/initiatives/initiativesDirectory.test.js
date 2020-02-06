// @flow

import {NodeAddress} from "../../core/graph";
import {createId, addressFromId} from "./initiative";
import {
  type InitiativeFile,
  type InitiativesDirectory,
  fromJSON,
  toJSON,
  initiativeFileURL,
  _initiativeFileId,
} from "./initiativesDirectory";

const exampleInitiativeFile = (): InitiativeFile => ({
  title: "Sample initiative",
  timestampIso: ("2020-01-08T22:01:57.766Z": any),
  completed: false,
  champions: ["http://foo.bar/champ"],
  contributions: ["http://foo.bar/contrib"],
  dependencies: ["http://foo.bar/dep"],
  references: ["http://foo.bar/ref"],
});

describe("plugins/initiatives/initiativesDirectory", () => {
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

  describe("_initiativeFileId", () => {
    it("should add the correct prefix to a remoteUrl and fileName", () => {
      // Given
      const dir: InitiativesDirectory = {
        localPath: "should-not-be-used",
        remoteUrl: "http://foo.bar/dir",
      };
      const fileName = "sample.json";

      // When
      const id = _initiativeFileId(dir, fileName);

      // Then
      expect(id).toEqual(createId("INITIATIVE_FILE", dir.remoteUrl, fileName));
    });
  });
});
