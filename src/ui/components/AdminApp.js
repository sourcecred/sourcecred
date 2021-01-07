// @flow

import React, {type Node as ReactNode, useEffect, useState} from "react";
import {Redirect, Route, useHistory} from "react-router-dom";
import {Admin, Resource, Layout, Loading} from "react-admin";
import {createMuiTheme} from "@material-ui/core/styles";
import pink from "@material-ui/core/colors/pink";
import fakeDataProvider from "ra-data-fakerest";
import {Explorer} from "./Explorer/Explorer";
import {ExplorerHome} from "./ExplorerHome/ExplorerHome";
import {LedgerAdmin} from "./LedgerAdmin";
import {CredView} from "../../analysis/credView";
import {AccountOverview} from "./AccountOverview";
import {Transfer} from "./Transfer";
import {SpecialDistribution} from "./SpecialDistribution";
import {load, type LoadResult, type LoadSuccess} from "../load";
import {type CurrencyDetails} from "../../api/currencyConfig";
import {withRouter} from "react-router-dom";
import AppBar from "./AppBar";
import createMenu from "./Menu";
import {LedgerProvider} from "../utils/LedgerContext";
import {LedgerViewer} from "./LedgerViewer/LedgerViewer";

const dataProvider = fakeDataProvider({}, true);

const theme = createMuiTheme({
  palette: {
    type: "dark",
    primary: pink,
  },
  overrides: {
    MuiChip: {
      sizeSmall: {
        height: "21px",
      },
      labelSmall: {
        fontSize: "0.66rem",
      },
    },
  },
});

const createAppLayout = ({hasBackend, currency}: LoadSuccess) => {
  const AppLayout = (props) => (
    <Layout
      {...props}
      appBar={AppBar}
      menu={withRouter(createMenu(hasBackend, currency))}
    />
  );
  return AppLayout;
};

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
    <Route key="accounts" exact path="/accounts">
      <AccountOverview currency={currency} />
    </Route>,
    <Route key="ledger" exact path="/ledger">
      <LedgerViewer currency={currency} />
    </Route>,
  ];
  const backendRoutes = [
    <Route key="admin" exact path="/admin">
      <LedgerAdmin />
    </Route>,
    <Route key="explorer-home" exact path="/explorer-home">
      <ExplorerHome initialView={credView} />
    </Route>,
    <Route key="transfer" exact path="/transfer">
      <Transfer currency={currency} />
    </Route>,
    <Route key="special-distribution" exact path="/special-distribution">
      <SpecialDistribution currency={currency} />
    </Route>,
  ];
  return routes.concat(hasBackend ? backendRoutes : []);
};

const AdminApp = (): ReactNode => {
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);
  useEffect(() => {
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
        layout={createAppLayout(loadSuccess)}
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
