// @flow

const fs = require("fs");
const path = require("path");
const jsonServer = require("json-server");
const serveStatic = require("serve-static");
const {getFilePath} = require("./loadFile");
const server = jsonServer.create();
const middlewares = jsonServer.defaults();
// TODO: process path input parameter and ensure it's a valid cred repo

const loadFiles = async () => {
  if (!process.argv[2]) {
    console.info(
      "Usage: adminServe <project folder>\n\n",
      "Please supply a relative or absolute path to a Project's SourceCred folder"
    );
    return;
  }
  const projectDir = path.resolve(process.argv[2]);

  // the order that middleware is installed is important here:
  // 1. default middlewares are installed first, or they won't function
  // 2. url rewriters are installed before the static paths are even set up
  // 3. everything must be installed before the jsonServer router is installed
  server.use(middlewares);
  server.use(
    jsonServer.rewriter({
      "/project": "/project/project.json",
      "/plugins": "/plugins/pluginDeclarations.json",
      "/graph": "/graph/weightedGraph.json",
    })
  );

  const projectPath = await getFilePath(projectDir, "project.json");
  server.use("/project", serveStatic(projectPath));
  const pluginPath = await getFilePath(projectDir, "pluginDeclarations.json");
  server.use("/plugins", serveStatic(pluginPath));
  const graphPath = await getFilePath(projectDir, "weightedGraph.json");
  server.use("/graph", serveStatic(graphPath));
  try {
    await fs.promises.stat(`${projectDir}/db.json`);
  } catch {
    const db = {initiatives: [{id: 0, info: "test"}]};
    fs.writeFileSync(`${projectDir}/db.json`, JSON.stringify(db), "utf8");
  }

  const router = jsonServer.router(`${projectDir}/db.json`);
  server.use(router);
  server.listen(3005, () => {
    console.info("JSON Server is running");
  });
};

loadFiles().catch(console.error);
