// @flow

import { getPlugin } from "./bundledPlugins";
import { fromString } from "./pluginId";
import fs from "fs-extra";
import rm from "rimraf";
import {promisify} from "util";
const rmdir = promisify(rm);


describe("api/bundledPlugins", () => {
  it("returns a local bundled plugin", async () => {
      const pluginId = fromString("sourcecred/initiatives");
      const plugin = getPlugin(pluginId);
      if(!plugin) {
        throw new Error("Could not find valid plugin")
      } 
      const declaration = await plugin.declaration();
      expect(declaration.name).toBe("Initiatives");
  });

  it("returns an external plugin", async () => {
      const pluginId = fromString("external/fakePlugin");
      const plugin = getPlugin(pluginId);
      if(!plugin) {
        throw new Error("Could not find valid plugin")
      } 
      const declaration = await plugin.declaration();
      expect(declaration.name).toBe("fakeplugin");
  });

  it("returns a package plugin", async ()=>{
    // create temp directory
    // copy over fixtures directory
    // transpile fixtures directory to js
    // refer to that path 
    // clean up temp directory
      const tmpDir = await fs.mkdtemp("tmp-sourcecred-test");
      console.log(tmpDir)
      await fs.copy(`${__dirname}/../plugins/package/fixtures`, `${tmpDir}`) 

      const pluginId = fromString(`${__dirname}/../plugins/package/fixtures`);
      const plugin = getPlugin(pluginId);
      if(!plugin) {
        throw new Error("Could not find valid plugin")
      } 
      const declaration = await plugin.declaration();
      expect(declaration.name).toBe("fakeplugin");

      await rmdir(tmpDir)

  })

});

