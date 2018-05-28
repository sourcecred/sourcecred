// @flow
import * as demo from "./graphDemoData";
import {Graph} from "./graph";

describe("graph", () => {
  describe("plugin handlers", () => {
    it("Graph stores plugins", () => {
      const plugins = demo.plugins();
      const graph = new Graph(plugins);
      expect(graph.plugins()).toEqual(plugins);
    });

    it("Graph stored a slice of the plugins", () => {
      const plugins = [];
      const graph = new Graph(plugins);
      plugins.push(new demo.Handler());
      expect(graph.plugins()).toHaveLength(0);
    });

    it("Graph returns a slice of the plugins", () => {
      const graph = new Graph([]);
      const plugins = graph.plugins();
      (plugins: any).push(new demo.Handler());
      expect(graph.plugins()).toHaveLength(0);
    });
  });
});
