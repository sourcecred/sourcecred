// @flow

const fs = require("fs");
const jsonServer = require("json-server");
import type {
  UnshapedInitiativeV1,
  UnshapedInitiativeV2,
  ShapedInitiativeV010,
  ShapedInitiativeV020,
} from "./ShapedInitiative";
const getFile = require("./getFile");
const server = jsonServer.create();
const middlewares = jsonServer.defaults();
// TODO: process path input parameter and ensure it's a valid cred repo
const projectDir = "TheSource";
const validPath = `../${projectDir}/initiatives/`;
const loadFiles = async () => {
  const db = {};
  db.graphs = [{id: 0, graph: await loadGraph()}];
  db.plugins = [{id: 0, plugins: await loadPlugins()}];
  db.project = [{id: 0, project: await loadProject()}];
  db.initiatives = loadInitiatives();
  fs.writeFileSync("db.json", JSON.stringify(db), "utf8");
};

// without context, it might look very sloppy to avoid deserialiazing this graph file
// but the production app will handle all this in the browser anyhow, so for now
// we'll defer optimizing the local server's handling of this file
const loadGraph = async (): Promise<string> => {
  const graphPath: string = await getFile(`../${projectDir}/`);
  return fs.promises.readFile(graphPath, "utf8");
};

const loadPlugins = async () => {
  const pluginDecPath: string = await getFile(
    `../${projectDir}/`,
    "pluginDeclarations.json"
  );
  return fs.promises.readFile(pluginDecPath, "utf8");
};

const loadProject = async () => {
  const projectPath: string = await getFile(
    `../${projectDir}/`,
    "project.json"
  );
  return fs.promises.readFile(projectPath, "utf8");
};

const loadInitiatives = () => {
  const initiatives = [];
  const files: Array<string> = fs
    .readdirSync(validPath)
    .filter((f) => RegExp(".json$").test(f));
  for (const fileName of files) {
    const initObj = JSON.parse(fs.readFileSync(validPath + fileName, "utf8"));
    try {
      initiatives.push(
        getShapedInitiativeFile(initObj, fileName, initiatives.length)
      );
    } catch {
      console.error(`File ${fileName} not v0.2.0. skipping...`);
    }
  }
  return initiatives;
};

const getShapedInitiativeFile = (fileJSON, fName, idx: number) => {
  if (fileJSON[0].version !== "0.2.0") {
    throw new Error(
      `Intitiative file must be version 0.2.0. Please upgrade ${fName}`
    );
  }
  return getShapedV020File((fileJSON: UnshapedInitiativeV2), fName);
};

const getShapedV010File = (
  fileJSON: UnshapedInitiativeV1,
  idx: number
): ShapedInitiativeV010 => {
  const {type, version} = fileJSON[0];
  const {
    title,
    timestampIso,
    weight,
    completed,
    dependencies,
    references,
    contributions,
    champions,
  } = fileJSON[1];

  return {
    id: idx,
    type,
    version,
    title,
    timestampIso,
    incompleteWeight: weight.incomplete,
    completeWeight: weight.complete,
    completed,
    dependencies,
    references,
    contributions,
    champions,
  };
};

const getShapedV020File = (
  fileJSON: UnshapedInitiativeV2,
  fileName: string
): ShapedInitiativeV020 => {
  const {type, version} = fileJSON[0];
  const {
    title,
    timestampIso,
    weight,
    completed,
    dependencies,
    references,
    contributions,
    champions,
  } = fileJSON[1];

  return {
    id: fileName,
    type,
    version,
    title,
    timestampIso,
    completed,
    champions,
    weight,
    dependencies,
    references,
    contributions,
  };
};

// TODO load contributors on the client side
// it's not really useful to do any of this processing here
// const loadContributors = () => {
//   contributors = [];
// };

if (process.mainModule.filename === __filename) {
  loadFiles()
    .then(() => {
      const router = jsonServer.router("db.json");
      server.use(middlewares);
      server.use(router);
      server.listen(3005, () => {
        console.info("JSON Server is running");
      });
    })
    .catch(console.error);
} else module.exports = loadFiles;
