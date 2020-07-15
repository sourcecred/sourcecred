// @flow

import React from "react";
import {Route, useHistory} from "react-router-dom";
import {Admin, Resource, Layout, Loading} from "react-admin";
import {createMuiTheme} from "@material-ui/core/styles";
import pink from "@material-ui/core/colors/pink";
import fakeDataProvider from "ra-data-fakerest";
import {fakeDB} from "../mock/fakeDB";
import {InitiativeList, InitiativeCreate, InitiativeEdit} from "./Initiatives";
import ExplorerApp, {load, type LoadResult} from "./ExplorerApp";
import Menu from "./Menu";
import {UserCreate, UserList} from "./Users";

const dataProvider = fakeDataProvider(fakeDB, true);

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

const InitiativesEditor = () => {
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
          layout={AppLayout}
          theme={theme}
          dataProvider={dataProvider}
          history={history}
          customRoutes={customRoutes}
        >
          <Resource
            name="users"
            list={UserList}
            create={UserCreate(loadResult.credView)}
          />
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
};

export default InitiativesEditor;
