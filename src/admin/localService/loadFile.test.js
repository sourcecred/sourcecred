// @flow
import {loadFile} from "./loadFile";
import fs from "fs";

describe("src/admin/localService/loadFile", () => {
  beforeAll(async () => {
    // Arrange
    await fs.promises.mkdir("./test/dir", {recursive: true});
    await fs.promises.writeFile("./test/dir/some-file.txt", "found me!");
  });
  it("finds and reads a file", async () => {
    // Act
    const filePath = await loadFile("test", "some-file.txt");
    // Assert
    expect(filePath).toEqual("found me!");
  });
  it("throws an error if no file is found in an existing directory", async () => {
    // Act
    return expect(loadFile("test", "missing-file.txt")).rejects.toThrow(
      // Assert
      "missing-file.txt not found. Please enter a full cred repo"
    );
  });
  it("throws an error if the entered directory doesn't exist", async () => {
    //arrange
    expect.assertions(1);
    // Act
    return expect(
      loadFile("missing-directory", "missing-file.txt")
    ).rejects.toThrow(
      "ENOENT: no such file or directory, scandir 'missing-directory/'"
    );
  });
  afterAll(async () => {
    await fs.promises.unlink("./test/dir/some-file.txt");
    await fs.promises.rmdir("./test/dir");
    return await fs.promises.rmdir("./test");
  });
});
