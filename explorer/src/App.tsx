import * as React from 'react';
import './App.css';
import { FileExplorer } from './FileExplorer';
import { UserExplorer } from './UserExplorer';
import { CommitData } from './commits';
import data from './commits.json';

interface AppProps {}

interface AppState {
  selectedPath: string;
  selectedUser?: string; // email
  data: CommitData;
}

class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);
    this.state = {
      selectedPath: '',
      selectedUser: undefined,
      data: data
    };
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">SourceCred Explorer</h1>
        </header>
        <FileExplorer
          onSelectPath={x => this.setState({ selectedPath: x })}
          selectedPath={this.state.selectedPath}
          data={this.state.data}
        />
        <UserExplorer
          selectedPath={this.state.selectedPath}
          selectedUser={this.state.selectedUser}
          onSelectUser={x => this.setState({ selectedUser: x })}
          data={this.state.data}
        />
      </div>
    );
  }
}

export default App;
