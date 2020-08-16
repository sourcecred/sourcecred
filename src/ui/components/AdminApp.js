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
import {Ledger} from "../../ledger/ledger";
import {GrainAccountOverview} from "./GrainAccountOverview";
import {TransferGrain} from "./TransferGrain";
import {SpecialGrainDistribution} from "./SpecialGrainDistribution";
import {load, type LoadResult, type LoadSuccess} from "../load";
import {withRouter} from "react-router-dom";
import AppBar from "./AppBar";
import Menu from "./Menu";

const dataProvider = fakeDataProvider({}, true);

const theme = createMuiTheme({
  palette: {
    type: "dark",
    primary: pink,
  },
});

const AppLayout = (hasBackend: Boolean) => (props) => (
  <Layout {...props} appBar={AppBar} menu={withRouter(Menu(hasBackend))} />
);

const customRoutes = (
  credView: CredView,
  hasBackend: Boolean,
  ledger: Ledger,
  setLedger: (Ledger) => void
) => {
  const routes = [
    <Route key="explorer" exact path="/explorer">
      <Explorer initialView={credView} />
    </Route>,
    <Route key="root" exact path="/">
      <Redirect to="/explorer" />
    </Route>,
    <Route key="grain" exact path="/grain">
      <GrainAccountOverview credView={credView} ledger={ledger} />
    </Route>,
  ];
  const backendRoutes = [
    <Route key="admin" exact path="/admin">
      <LedgerAdmin credView={credView} ledger={ledger} setLedger={setLedger} />
    </Route>,
    <Route key="transfer" exact path="/transfer">
      <TransferGrain ledger={ledger} setLedger={setLedger} />
    </Route>,
    <Route key="special-distribution" exact path="/special-distribution">
      <SpecialGrainDistribution ledger={ledger} setLedger={setLedger} />
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
  const [ledger, setLedger] = React.useState<Ledger>(loadSuccess.ledger);
  const history = useHistory();
  return (
    <Admin
      layout={AppLayout(loadSuccess.hasBackend)}
      theme={theme}
      dataProvider={dataProvider}
      history={history}
      customRoutes={customRoutes(
        loadSuccess.credView,
        loadSuccess.hasBackend,
        ledger,
        setLedger
      )}
    >
      {/*
          This dummy resource is required to get react
          admin working beyond the hello world screen
        */}
      <Resource name="dummyResource" />
    </Admin>
  );
};

type AdminInnerProps = {|
  +loadResult: LoadSuccess,
|};

export default AdminApp;
