// @flow

import React from "react";
import {Admin, Loading} from "react-admin";
import fakeDataProvider from "ra-data-fakerest";
import {createMemoryHistory} from "history";
import {createMuiTheme} from "@material-ui/core/styles";
import pink from "@material-ui/core/colors/pink";
import {Graph, type Node} from "../../core/graph";
import {type WeightedGraphJSON} from "../../core/weightedGraph";
import {type PluginDeclaration} from "../../analysis/pluginDeclaration";
import {type CredResult} from "../../analysis/credResult";
import {fromCompat, type Compatible} from "../../util/compat";
import {loadUsers, loadActivities} from "../editorUtils";

async function loadAndReport(
  path: string
): Promise<{
  plugins: Compatible<PluginDeclaration[]>,
  weightedGraph: WeightedGraphJSON,
}> {
  const response = await fetch(path);
  if (!response.ok) {
    console.error(path, response);
  }
  const res: Compatible<CredResult> = await response.json();
  return fromCompat({type: "sourcecred/credResult", version: "0.1.0"}, res);
}

const dataProvider = fakeDataProvider({}, true);

const history = createMemoryHistory();

const theme = createMuiTheme({
  palette: {
    type: "dark",
    primary: pink,
  },
});

export type AppState = {|
  graph: ?Graph,
  plugins: ?(PluginDeclaration[]),
  users: Node[],
  activities: Node[],
  loaded: boolean,
|};

export default class App extends React.Component<{||}, AppState> {
  constructor(props: Object) {
    super(props);
    this.state = {
      graph: null,
      plugins: null,
      users: [],
      activities: [],
      loaded: false,
    };
  }
  async componentDidMount() {
    const {
      weightedGraph: [, {graphJSON}],
      plugins: [, plugins],
    } = await loadAndReport("output/credResult.json");
    const graph = Graph.fromJSON(graphJSON);
    const users = loadUsers(plugins, graph);
    const activities = loadActivities(plugins, graph);
    this.setState({
      graph,
      plugins,
      users,
      activities,
      loaded: true,
    });
  }

  render() {
    if (!this.state.loaded)
      return (
        <Loading
          loadingPrimary="Fetching cred details..."
          loadingSecondary="Your patience is appreciated"
        />
      );
    return (
      <Admin
        theme={theme}
        dataProvider={dataProvider}
        history={history}
      ></Admin>
    );
  }
}
