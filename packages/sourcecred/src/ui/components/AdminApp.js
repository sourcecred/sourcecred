// @flow

import React, {type Node as ReactNode, useEffect, useState} from "react";
import {Redirect, Route, useHistory} from "react-router-dom";
import {Admin, Resource, Layout, Loading} from "react-admin";
import {createMuiTheme} from "@material-ui/core/styles";
import pink from "@material-ui/core/colors/pink";
import {makeStyles} from "@material-ui/core/styles";
import fakeDataProvider from "ra-data-fakerest";
import {ExplorerHome} from "./ExplorerHome/ExplorerHome";
import {ProfilePage} from "./Profile/ProfilePage";
import WeightsConfigSection from "./Explorer/WeightsConfigSection";
import {LedgerAdmin} from "./LedgerAdmin";
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
import {type PluginDeclaration} from "../../analysis/pluginDeclaration";
import {type WeightsT} from "../../core/weights";
import {Web3ContextProvider} from "../utils/Web3Context";

const dataProvider = fakeDataProvider({}, true);

const theme = createMuiTheme({
  palette: {
    type: "dark",
    backgroundColor: "#303030",
    primary: pink,
    blueish: "#6174CC",
    lavender: "#C5A2C5",
    orange: "#FFDDC6",
    darkOrange: "#FFAA3D",
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
    warning: {
      main: "#FFAA3D",
    },
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
const createAppLayout = ({hasBackend, currency, isDev}: LoadSuccess) => {
  const AdminAppBar = (props) => <AppBar isDev={isDev} {...props} />;
  const AppLayout = (props) => {
    const classes = useLayoutStyles(props);
    return (
      <Layout
        className={classes.layout}
        {...props}
        appBar={AdminAppBar}
        menu={withRouter(createMenu(hasBackend, currency, isDev))}
      />
    );
  };
  return AppLayout;
};

const customRoutes = (
  hasBackend: boolean,
  currency: CurrencyDetails,
  credGrainView: CredGrainView | null,
  pluginDeclarations: $ReadOnlyArray<PluginDeclaration>,
  isDev: boolean,
  weights: WeightsT
) => {
  const [weightsState, setWeightsState] = useState<{weights: WeightsT}>({
    weights,
  });
  const routes = [
    <Route key="explorer" exact path="/explorer">
      <ExplorerHome initialView={credGrainView} currency={currency} />
    </Route>,
    <Route key="root" exact path="/">
      <Redirect to={credGrainView ? "/explorer" : "/accounts"} />
    </Route>,
    <Route key="explorer-home" exact path="/explorer-home">
      <Redirect to={"/explorer"} />
    </Route>,
    <Route key="accounts" exact path="/accounts">
      <AccountOverview currency={currency} />
    </Route>,
    <Route key="ledger" exact path="/ledger">
      <LedgerViewer currency={currency} />
    </Route>,
  ];
  const backendRoutes = hasBackend
    ? [
        <Route key="admin" exact path="/admin">
          <LedgerAdmin />
        </Route>,
        <Route key="transfer" exact path="/transfer">
          <Transfer currency={currency} />
        </Route>,
        <Route key="special-distribution" exact path="/special-distribution">
          <SpecialDistribution currency={currency} />
        </Route>,
        <Route key="weight-config" exact path="/weight-config">
          <WeightsConfigSection
            show={true}
            pluginDeclarations={pluginDeclarations}
            weights={weightsState.weights}
            setWeightsState={setWeightsState}
          />
        </Route>,
      ]
    : [];
  const devRoutes = isDev
    ? [
        <Route key="profile" exact path="/profile">
          <ProfilePage />
        </Route>,
      ]
    : [];
  return routes.concat(backendRoutes, devRoutes);
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

  return (
    // TODO (@topocount) create context for read-only instance state
    <LedgerProvider ledgerManager={loadSuccess.ledgerManager}>
      <Web3ContextProvider>
        <Admin
          disableTelemetry
          layout={createAppLayout(loadSuccess)}
          theme={theme}
          dataProvider={dataProvider}
          history={history}
          customRoutes={customRoutes(
            loadSuccess.hasBackend,
            loadSuccess.currency,
            loadSuccess.credGrainView,
            Array.from(loadSuccess.bundledPlugins.values()),
            loadSuccess.isDev,
            loadSuccess.weights
          )}
        >
          {/*
            This dummy resource is required to get react
            admin working beyond the hello world screen
          */}
          <Resource name="dummyResource" />
        </Admin>
      </Web3ContextProvider>
    </LedgerProvider>
  );
};

type AdminInnerProps = {|
  +loadResult: LoadSuccess,
|};

export default AdminApp;
