// @flow
import {loadFile} from "./loadFile";
import fs from "fs";

const testDirRoot = "./test";
const testDirPath = `${testDirRoot}/dir`;
const testFilePath = `${testDirPath}/some-file.txt`;

describe("src/admin/localService/loadFile", () => {
  beforeAll(async () => {
    // Arrange
    await fs.promises.mkdir(testDirPath, {recursive: true});
    await fs.promises.writeFile(testFilePath, "found me!");
  });
  it("finds and reads a file", async () => {
    // Arrange
    expect.assertions(1);
    // Act
    const fileContent = await loadFile("test", "some-file.txt");
    // Assert
    expect(fileContent).toEqual("found me!");
  });
  it("throws an error if no file is found in an existing directory", async () => {
    // Arrange
    expect.assertions(1);
    // Act
    return expect(loadFile("test", "missing-file.txt")).rejects.toThrow(
      // Assert
      "missing-file.txt not found. Please enter the root folder for Cred repo that contains the file."
    );
  });
  it("throws an error if the entered directory doesn't exist", async () => {
    // Arrange
    expect.assertions(1);
    // Act
    return expect(
      loadFile("missing-directory", "missing-file.txt")
    ).rejects.toThrow(
      "ENOENT: no such file or directory, scandir 'missing-directory/'"
    );
  });
  afterAll(async () => {
    await fs.promises.unlink(testFilePath);
    await fs.promises.rmdir(testDirPath);
    return await fs.promises.rmdir(testDirRoot); // recursive dir unlinking is still unstable, thus this second step
  });
});
