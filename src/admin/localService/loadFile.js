// @flow
const fs = require("fs");
const pathJoin = require("path").join;

const readdir = fs.promises.readdir;

/**
 * load file into server memory
 */
async function loadFile(credDir: string, fileName: string): Promise<string> {
  const filePath = await getFilePath(`${credDir}/`, fileName);
  if (!filePath)
    return Promise.reject(
      new Error(
        `${fileName} not found. Please enter the root folder for Cred repo that contains the file.`
      )
    );

  return fs.promises.readFile(pathJoin(filePath, fileName), "utf8");
}

/**
 * server utility function used to naively locate ancillary files needed in the frontend:
 * weightedGraph.json
 * project.json
 * pluginDeclarations.json
 *
 * Recursively traverses the provided `dir` until it finds the first instance of the `targetFile`
 * and returns the containing path to the file's directory. Otherwise it return a falsy empty string
 */
async function getFilePath(dir: string, targetFile: string): Promise<string> {
  const files: Dirent[] = await ((readdir(dir, {
    withFileTypes: true,
  }): any): Promise<Dirent[]>); // Dirent is not currently in the builtin node flow-typed lib
  if (files.map((f) => f.name).includes(targetFile)) return dir;
  const search = files
    .filter((f) => f.isDirectory())
    .map(async (f) => {
      return await getFilePath(pathJoin(dir, f.name), targetFile);
    });
  if (!search.length) return "";

  const results: Array<string> = await Promise.all(search);
  return results.find((e) => !!e) || "";
}

type Dirent = {|
  name: string,
  type: number,
  isDirectory(): boolean,
|};

module.exports = {loadFile, getFilePath};
