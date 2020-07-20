// @flow

import React from "react";
import {Redirect, Route, useHistory} from "react-router-dom";
import {Admin, Resource, Layout, Loading} from "react-admin";
import {createMuiTheme} from "@material-ui/core/styles";
import pink from "@material-ui/core/colors/pink";
import fakeDataProvider from "ra-data-fakerest";
import {Explorer} from "./Explorer";
import {load, type LoadResult, type LoadSuccess} from "../load";
import {withRouter} from "react-router-dom";
import Menu from "./Menu";

const dataProvider = fakeDataProvider({}, true);

const theme = createMuiTheme({
  palette: {
    type: "dark",
    primary: pink,
  },
});

const AppLayout = (loadResult: LoadSuccess) => (props) => (
  <Layout {...props} menu={withRouter(Menu(loadResult))} />
);

const customRoutes = (loadResult: LoadSuccess) => [
  <Route key="explorer" exact path="/explorer">
    <Explorer initialView={loadResult.credView} />
  </Route>,
  <Route key="root" exact path="/">
    <Redirect to="/explorer" />
  </Route>,
];

const AdminApp = () => {
  const [loadResult, setLoadResult] = React.useState<LoadResult | null>(null);
  React.useEffect(() => {
    load().then(setLoadResult);
  }, []);
  const history = useHistory();

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
        <Admin
          layout={AppLayout(loadResult)}
          theme={theme}
          dataProvider={dataProvider}
          history={history}
          customRoutes={customRoutes(loadResult)}
        >
          {/*
          This dummy resource is required to get react
          admin working beyond the hello world screen
        */}
          <Resource name="dummyResource" />
        </Admin>
      );
    default:
      throw new Error((loadResult.type: empty));
  }
};

export default AdminApp;
