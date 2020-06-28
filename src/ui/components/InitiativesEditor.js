// @flow

import React from "react";
import {Admin, Resource, Loading} from "react-admin";
import {
  InitiativeList,
  InitiativeCreate,
  InitiativeEdit,
} from "../components/Initiatives";
import fakeDataProvider from "ra-data-fakerest";
import {fakeInitiatives} from "../mock/fakeInitiatives";
import {createMemoryHistory} from "history";
import {createMuiTheme} from "@material-ui/core/styles";
import pink from "@material-ui/core/colors/pink";
import {load, type Props, type State} from "./ExplorerApp";

const dataProvider = fakeDataProvider(fakeInitiatives, true);

const history = createMemoryHistory();

const theme = createMuiTheme({
  palette: {
    type: "dark",
    primary: pink,
  },
});

export default class App extends React.Component<Props, State> {
  constructor(props: Object) {
    super(props);
    this.state = {
      loadResult: null,
    };
  }
  async componentDidMount() {
    this.setState({
      loadResult: await load(),
    });
  }

  render() {
    const {loadResult} = this.state;
    if (!loadResult) {
      return (
        <Loading
          loadingPrimary="Fetching cred details..."
          loadingSecondary="Your patience is appreciated"
        />
      );
    }
    switch (loadResult.type) {
      case "FAILURE":
        return (
          <div>
            <h1>Load Failure</h1>
            <p>Check console for details.</p>
          </div>
        );
      case "SUCCESS":
        return (
          <Admin theme={theme} dataProvider={dataProvider} history={history}>
            <Resource
              name="initiatives"
              list={InitiativeList}
              create={InitiativeCreate(loadResult.credView)}
              edit={InitiativeEdit(loadResult.credView)}
            />
          </Admin>
        );
      default:
        throw new Error((loadResult.type: empty));
    }
  }
}
