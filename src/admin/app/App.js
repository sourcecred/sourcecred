//@flow
import React, {useState, useEffect} from "react";
import {Admin, Resource, Loading} from "react-admin";
import {
  InitiativeList,
  InitiativeEdit,
  InitiativeCreate,
} from "./components/Initiatives";
import jsonServerProvider from "ra-data-json-server";
import {initGraph, localAddress} from "./graph";
import {createMuiTheme} from "@material-ui/core/styles";
const dataProvider = jsonServerProvider(localAddress);

const App = () => {
  const [scData, setScData] = useState(scDataInitialState);
  useEffect(() => {
    initGraph(setScData);
  }, []);
  console.log("scData: ", scData);
  if (!scData.loaded)
    return (
      <Loading
        loadingPrimary="Fetching cred details..."
        loadingSecondary="Your patience is appreciated!"
      />
    );
  return (
    <Admin theme={theme} dataProvider={dataProvider}>
      <Resource
        name="initiatives"
        list={InitiativeList(scData)}
        edit={InitiativeEdit(scData)}
        create={InitiativeCreate(scData)}
      />
    </Admin>
  );
};

const theme = createMuiTheme({
  palette: {
    type: "dark", // Switching the dark mode on is a single property value change.
  },
});

const scDataInitialState = {
  graph: null,
  plugins: null,
  users: [],
  activities: [],
  project: null,
  loaded: false,
};

export default App;
