// @flow

import React from "react";
import {Admin} from "react-admin";
import fakeDataProvider from "ra-data-fakerest";
import {createMemoryHistory} from "history";
import {createMuiTheme} from "@material-ui/core/styles";
import pink from "@material-ui/core/colors/pink";

const dataProvider = fakeDataProvider({}, true);

const history = createMemoryHistory();

const theme = createMuiTheme({
  palette: {
    type: "dark",
    primary: pink,
  },
});

export default class App extends React.Component<{||}, {||}> {
  render() {
    return (
      <Admin theme={theme} dataProvider={dataProvider} history={history} />
    );
  }
}
