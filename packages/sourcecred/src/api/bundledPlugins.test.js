// @flow

import {getPlugin} from "./bundledPlugins";
import {fromString, fromStringRaw} from "./pluginId";

describe("api/bundledPlugins", () => {
  it("returns a local bundled plugin", async () => {
    const pluginId = fromString("sourcecred/initiatives");
    const plugin = getPlugin(pluginId);
    if (!plugin) {
      throw new Error("Could not find valid plugin");
    }
    const declaration = await plugin.declaration();
    expect(declaration.name).toBe("Initiatives");
  });

  it("returns an external plugin", async () => {
    const pluginId = fromString("external/fakePlugin");
    const plugin = getPlugin(pluginId);
    if (!plugin) {
      throw new Error("Could not find valid plugin");
    }
    const declaration = await plugin.declaration();
    expect(declaration.name).toBe("fakeplugin");
  });

  it("returns a package plugin", async () => {
    const pluginId = fromStringRaw(
      `${__dirname}/../../dist/fixtures/packagePlugin/api.js`
    );
    const plugin = getPlugin(pluginId);
    if (!plugin) {
      throw new Error("Could not find valid plugin");
    }
    const declaration = await plugin.declaration();
    expect(declaration.name).toBe("test_custom_identity");
    //await rmdir(tmpDir)
  });

  it("returns a package plugin from an ambient module", async () => {
    const pluginId = fromStringRaw(`zcstarr-sourcecred-test-package-plugin`);
    const plugin = getPlugin(pluginId);
    if (!plugin) {
      throw new Error("Could not find valid plugin");
    }
    const declaration = await plugin.declaration();
    expect(declaration.name).toBe("test_custom_identity");
  });
});
