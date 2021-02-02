// @flow

import React, {
  type Node as ReactNode,
  useEffect,
  useState,
  useMemo,
} from "react";
import {Redirect, Route, useHistory} from "react-router-dom";
import {Admin, Resource, Layout, Loading} from "react-admin";
import {createMuiTheme} from "@material-ui/core/styles";
import pink from "@material-ui/core/colors/pink";
import {makeStyles} from "@material-ui/core/styles";
import fakeDataProvider from "ra-data-fakerest";
import {Explorer} from "./Explorer/Explorer";
import {ExplorerHome} from "./ExplorerHome/ExplorerHome";
import {LedgerAdmin} from "./LedgerAdmin";
import {CredView} from "../../analysis/credView";
import {CredGrainView} from "../../core/credGrainView";
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
    blueish: "#6174CC",
    lavender: "#C5A2C5",
    orange: "#FFDDC6",
    peach: "#FFF1E8",
    white: "#FAFBFD",
    scPink: "#FDBBD1",
    green: "#4BD76D",
    sunset: "#FFE9DB",
    salmon: "#FFE5E1",
    coral: "#F9D1CB",
    pink: "#FEDDE8",
    blue: "#728DFF",
    purple: "#C5A2C5",
    violet: "#EDDAEE",
    warning: "#FFAA3D",
    danger: "#FF594D",
    text: {
      link: "#31AAEE",
    },
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

const useLayoutStyles = makeStyles(
  () => ({
    layout: {
      overflowX: "hidden",
    },
  }),
  {name: "RaLayout"}
);
const createAppLayout = ({hasBackend, currency}: LoadSuccess) => {
  const AppLayout = (props) => {
    const classes = useLayoutStyles(props);
    return (
      <Layout
        className={classes.layout}
        {...props}
        appBar={AppBar}
        menu={withRouter(createMenu(hasBackend, currency))}
      />
    );
  };
  return AppLayout;
};

const customRoutes = (
  credView: CredView | null,
  hasBackend: Boolean,
  currency: CurrencyDetails,
  credGrainView: CredGrainView | null
) => {
  const routes = [
    <Route key="explorer" exact path="/explorer">
      <Explorer initialView={credView} />
    </Route>,
    <Route key="root" exact path="/">
      <Redirect to={credView ? "/explorer" : "/accounts"} />
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
      <ExplorerHome initialView={credGrainView} currency={currency} />
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
          <p>{loadResult.error}</p>
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
  const credGrainView = useMemo(
    () =>
      loadSuccess.credGraph
        ? new CredGrainView(
            loadSuccess.credGraph,
            loadSuccess.ledgerManager.ledger
          )
        : null,
    [loadSuccess.credGraph, loadSuccess.ledgerManager.ledger]
  );

  return (
    // TODO (@topocount) create context for read-only instance state
    <LedgerProvider ledgerManager={loadSuccess.ledgerManager}>
      <Admin
        layout={createAppLayout(loadSuccess)}
        theme={theme}
        dataProvider={dataProvider}
        history={history}
        customRoutes={customRoutes(
          loadSuccess.credView,
          loadSuccess.hasBackend,
          loadSuccess.currency,
          credGrainView
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
