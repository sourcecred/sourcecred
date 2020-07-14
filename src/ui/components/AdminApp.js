// @flow

import React from "react";
import {Admin, Resource, Layout, Loading} from "react-admin";
import fakeDataProvider from "ra-data-fakerest";
import {createMemoryHistory} from "history";
import {createMuiTheme} from "@material-ui/core/styles";
import pink from "@material-ui/core/colors/pink";
import {load, type LoadResult} from "./ExplorerApp";
import ExplorerApp from "./ExplorerApp";
import Menu from "./Menu";
import {Route} from "react-router-dom";

const dataProvider = fakeDataProvider({}, true);

const theme = createMuiTheme({
  palette: {
    type: "dark",
    primary: pink,
  },
});

const AppLayout = (props) => <Layout {...props} menu={Menu} />;

const customRoutes = [
  <Route key={0} exact path="/explorer" component={ExplorerApp} />,
];

const AdminApp = () => {
  const [loadResult, setLoadResult] = React.useState<LoadResult | null>(null);
  React.useEffect(() => {
    load().then(setLoadResult);
  }, []);

  // relative history (using a basename) does not work with the `Admin` component
  // therefore a memoryHistory instance will be utilized with the `Admin` component
  // so it maintains its own internal routing for now, while still working with
  // a url basename
  //const history = useHistory();
  const history = createMemoryHistory();

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
          layout={AppLayout}
          theme={theme}
          dataProvider={dataProvider}
          history={history}
          customRoutes={customRoutes}
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
