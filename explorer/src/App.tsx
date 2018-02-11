import * as React from 'react';
import './App.css';
import { FileExplorer } from './FileExplorer.tsx';
import { UserExplorer } from './UserExplorer.tsx';

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      selectedPath: '',
      selectedUser: null,
      data: null
    };
  }

  loadData() {
    fetch('public/tensorboard_commits.json')
      .then(response => response.json())
      .then(json => this.setStaet({ data: json }));
  }

  componentDidMount() {
    this.loadData();
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">SourceCred Explorer</h1>
        </header>
        <FileExplorer
          className="file-explorer"
          onSelectPath={x => this.setState({ selectedPath: x })}
          selectedPath={this.state.selectedPath}
          data={data}
        />
        <UserExplorer
          className="user-explorer"
          selectedPath={this.state.selectedPath}
          selectedUser={this.state.selectedUser}
          onSelectUser={x => this.setState({ selectedUser: x })}
          data={data}
        />
      </div>
    );
  }
}

export default App;
