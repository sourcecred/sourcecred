// @flow

import React from "react";
import {Redirect, Route, useHistory} from "react-router-dom";
import {Admin, Resource, Layout, Loading} from "react-admin";
import {createMuiTheme} from "@material-ui/core/styles";
import pink from "@material-ui/core/colors/pink";
import fakeDataProvider from "ra-data-fakerest";
import {Explorer} from "./Explorer";
import {LedgerAdmin} from "./LedgerAdmin";
import {CredView} from "../../analysis/credView";
import {AccountOverview} from "./AccountOverview";
import {Transfer} from "./Transfer";
import {SpecialDistribution} from "./SpecialDistribution";
import {
  load,
  type LoadResult,
  type LoadSuccess,
  type CurrencyDetails,
} from "../load";
import {withRouter} from "react-router-dom";
import AppBar from "./AppBar";
import Menu from "./Menu";
import {LedgerProvider} from "../utils/LedgerContext";

const dataProvider = fakeDataProvider({}, true);

const theme = createMuiTheme({
  palette: {
    type: "dark",
    primary: pink,
  },
});

const AppLayout = ({hasBackend, currency}: LoadSuccess) => (props) => (
  <Layout
    {...props}
    appBar={AppBar}
    menu={withRouter(Menu(hasBackend, currency))}
  />
);

const customRoutes = (
  credView: CredView,
  hasBackend: Boolean,
  currency: CurrencyDetails
) => {
  const routes = [
    <Route key="explorer" exact path="/explorer">
      <Explorer initialView={credView} />
    </Route>,
    <Route key="root" exact path="/">
      <Redirect to="/explorer" />
    </Route>,
    <Route key="grain" exact path="/grain">
      <AccountOverview currency={currency} />
    </Route>,
  ];
  const backendRoutes = [
    <Route key="admin" exact path="/admin">
      <LedgerAdmin credView={credView} />
    </Route>,
    <Route key="transfer" exact path="/transfer">
      <Transfer currency={currency} />
    </Route>,
    <Route key="special-distribution" exact path="/special-distribution">
      <SpecialDistribution />
    </Route>,
  ];
  return routes.concat(hasBackend ? backendRoutes : []);
};

const AdminApp = () => {
  const [loadResult, setLoadResult] = React.useState<LoadResult | null>(null);
  React.useEffect(() => {
    load().then(setLoadResult);
  }, []);

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
      return <AdminInner loadResult={loadResult} />;
    default:
      throw new Error((loadResult.type: empty));
  }
};

/**
 * AdminInner keeps track of the Ledger state so that if one component
 * changes the ledger, the others use the updated ledger instead of the
 * initial one. We may want to handle CredViews the same way, since the
 * explorer can re-calculate it.
 */
const AdminInner = ({loadResult: loadSuccess}: AdminInnerProps) => {
  const history = useHistory();

  return (
    // TODO (@topocount) create context for read-only instance state
    <LedgerProvider initialLedger={loadSuccess.ledger}>
      <Admin
        layout={AppLayout(loadSuccess)}
        theme={theme}
        dataProvider={dataProvider}
        history={history}
        customRoutes={customRoutes(
          loadSuccess.credView,
          loadSuccess.hasBackend,
          loadSuccess.currency
        )}
      >
        {/*
          This dummy resource is required to get react
          admin working beyond the hello world screen
        */}
        <Resource name="dummyResource" />
      </Admin>
    </LedgerProvider>
  );
};

type AdminInnerProps = {|
  +loadResult: LoadSuccess,
|};

export default AdminApp;
