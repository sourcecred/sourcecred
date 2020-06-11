//@flow
import React, {useState, useEffect} from "react";
import {Admin, Resource} from "react-admin";
import {
  InitiativeList,
  InitiativeEdit,
  InitiativeCreate,
} from "./components/Initiatives";
import jsonServerProvider from "ra-data-json-server";
import {initGraph, initPlugins, project} from "./graph";
import {createMuiTheme} from "@material-ui/core/styles";
const dataProvider = jsonServerProvider("http://localhost:3005");
//initGraph(dataProvider);

const App = () => {
  const [scData, setScData] = useState(scDataInitialState);
  useEffect(() => {
    initGraph(dataProvider, setScData);
  }, [scData.loaded]);
  console.log("scData: ", scData);
  return (
    <Admin theme={theme} dataProvider={dataProvider}>
      <Resource
        name="initiatives"
        list={InitiativeList}
        edit={InitiativeEdit(scData)}
        create={InitiativeCreate}
        scData={scData}
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
