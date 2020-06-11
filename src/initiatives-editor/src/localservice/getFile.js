// @flow
const fs = require("fs");
const pathJoin = require("path").join;
const rootDir = "../sc-cred/";

const getFile = async (
  dir: string,
  targetFile: string = "weightedGraph.json"
): Promise<string | void> => {
  const files: Array<Dirent> = await fs.promises.readdir(dir, {
    withFileTypes: true,
  });
  if (files.map((f) => f.name).includes(targetFile))
    return pathJoin(dir, targetFile);
  let search = files
    .filter((f) => f.isDirectory())
    .map(async (f) => {
      return await getFile(pathJoin(dir, f.name), targetFile);
    });
  if (search.length > 0) {
    let results: Array<string | void> = await Promise.all(search);
    return results.find((e) => !!e) || undefined;
  }
};

if (process.mainModule.filename === __filename) {
  getFile(rootDir).then(console.log).catch(console.error);
} else module.exports = getFile;

type Dirent = {|
  name: string,
  type: number,
  isDirectory: function,
|};
