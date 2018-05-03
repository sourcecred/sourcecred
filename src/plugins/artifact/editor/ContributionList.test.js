// @flow

import type {ReactWrapper} from "enzyme";
import React from "react";
import {shallow} from "enzyme";
import enzymeToJSON from "enzyme-to-json";

import type {Address} from "../../../core/address";
import type {Node} from "../../../core/graph";
import type {PluginAdapter} from "./pluginAdapter";
import {AdapterSet} from "./adapterSet";
import {ContributionList} from "./ContributionList";
import {Graph} from "../../../core/graph";

require("./testUtil").configureAphrodite();
require("./testUtil").configureEnzyme();

function createTestData(): * {
  type PayloadA = number;
  type PayloadB = boolean;
  type PayloadC = string;
  type NodePayload = PayloadA | PayloadB | PayloadC;
  type EdgePayload = null;

  const PLUGIN_A = "sourcecred/example-plugin-a";
  const PLUGIN_B = "sourcecred/example-plugin-b";
  const PLUGIN_C = "sourcecred/example-plugin-c";

  function makeAddress(
    pluginName: typeof PLUGIN_A | typeof PLUGIN_B | typeof PLUGIN_C,
    type: string,
    id: string
  ): Address {
    return {
      pluginName,
      id,
      type,
    };
  }

  const nodeA1 = () => ({
    address: makeAddress(PLUGIN_A, "small", "one"),
    payload: (111: PayloadA),
  });
  const nodeA2 = () => ({
    address: makeAddress(PLUGIN_A, "small", "two"),
    payload: (234: PayloadA),
  });
  const nodeA3 = () => ({
    address: makeAddress(PLUGIN_A, "big", "three"),
    payload: (616: PayloadA),
  });
  const nodeB4 = () => ({
    address: makeAddress(PLUGIN_B, "very true", "four"),
    payload: (true: PayloadB),
  });
  const nodeC5 = () => ({
    address: makeAddress(PLUGIN_C, "ctype", "five"),
    payload: ("I have no adapter :-(": PayloadC),
  });
  const edgeA1A2 = () => ({
    address: makeAddress(PLUGIN_A, "atype", "one-to-two"),
    payload: null,
    src: nodeA1().address,
    dst: nodeA2().address,
  });
  const edgeB4A3 = () => ({
    address: makeAddress(PLUGIN_C, "ctype", "four-to-three"),
    payload: null,
    src: nodeB4().address,
    dst: nodeA3().address,
  });

  const graph: () => Graph<NodePayload, EdgePayload> = () =>
    new Graph()
      .addNode(nodeA1())
      .addNode(nodeA2())
      .addNode(nodeA3())
      .addNode(nodeB4())
      .addNode(nodeC5())
      .addEdge(edgeA1A2())
      .addEdge(edgeB4A3());

  const adapterA: () => PluginAdapter<PayloadA> = () => ({
    pluginName: PLUGIN_A,
    renderer: class RendererA extends React.Component<{
      graph: Graph<any, any>,
      node: Node<PayloadA>,
    }> {
      render() {
        const {graph, node} = this.props;
        const neighborCount = graph.neighborhood(node.address, {
          direction: "OUT",
        }).length;
        return (
          <span>
            <tt>{node.address.id}</tt> has neighbor count{" "}
            <strong>{neighborCount}</strong>
          </span>
        );
      }
    },
    extractTitle(graph: Graph<NodePayload, EdgePayload>, node: Node<PayloadA>) {
      return `the number ${String(node.payload)}`;
    },
  });

  const adapterB: () => PluginAdapter<PayloadB> = () => ({
    pluginName: PLUGIN_B,
    renderer: class RendererB extends React.Component<{
      graph: Graph<any, any>,
      node: Node<PayloadB>,
    }> {
      render() {
        const {node} = this.props;
        return (
          <span>
            Node <em>{node.address.id}</em>: <strong>{node.payload}</strong>
          </span>
        );
      }
    },
    extractTitle(graph: Graph<NodePayload, EdgePayload>, node: Node<PayloadB>) {
      return String(node.payload).toUpperCase() + "!";
    },
  });

  const adapters: () => AdapterSet = () => {
    const result = new AdapterSet();
    result.addAdapter(adapterA());
    result.addAdapter(adapterB());
    return result;
  };

  return {
    PLUGIN_A,
    PLUGIN_B,
    PLUGIN_C,
    nodeA1,
    nodeA2,
    nodeA3,
    nodeB4,
    nodeC5,
    edgeA1A2,
    edgeB4A3,
    graph,
    adapterA,
    adapterB,
    adapters,
  };
}

describe("ContributionList", () => {
  // Render a contribution list with the above test data.
  function render() {
    const data = createTestData();
    const result = shallow(
      <ContributionList graph={data.graph()} adapters={data.adapters()} />
    );
    return result;
  }

  // Select the unique <option> whose text matches the given patern.
  function simulateSelect(container: ReactWrapper, pattern: RegExp): void {
    const targetOption = container
      .find("option")
      .filterWhere((x) => pattern.test(x.text()));
    expect(targetOption).toHaveLength(1);
    container
      .find("select")
      .simulate("change", {target: {value: targetOption.prop("value")}});
  }

  it("renders some test data in the default state", () => {
    const result = render();
    expect(enzymeToJSON(result)).toMatchSnapshot();
  });

  it("updates the node table when a filter is selected", () => {
    const result = render();
    simulateSelect(result, /small/);
    expect(enzymeToJSON(result)).toMatchSnapshot();
  });

  it("resets the node table when a filter is deselected", () => {
    const result = render();
    const originalHtml = result.html();
    simulateSelect(result, /big/);
    const intermediateHtml = result.html();
    simulateSelect(result, /Show all/);
    const finalHtml = result.html();
    expect(finalHtml).toEqual(originalHtml);
    expect(finalHtml).not.toEqual(intermediateHtml);
  });
});
