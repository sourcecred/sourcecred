// @flow
import React, {Component} from "react";
import "./App.css";
import {GraphExplorer} from "./GraphExplorer";

type Props = {};
type State = {};

class App extends Component<Props, State> {
  render() {
    return (
      <div className="App" style={{backgroundColor: "#eeeeee"}}>
        <header
          style={{
            backgroundColor: "#01579B",
            color: "white",
            gridArea: "header",
            textAlign: "center",
            boxShadow: "0px 2px 2px #aeaeae",
          }}
        >
          <h1 style={{fontSize: "1.5em"}}>SourceCred Explorer</h1>
        </header>

        <GraphExplorer />
      </div>
    );
  }
}

export default App;
