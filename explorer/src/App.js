import React, { Component } from 'react';
import data from './data.json';
import './App.css';

function buildTree(fileNames) {
  const sortedFileNames = fileNames.slice().sort();
  const topLevelBuckets = {};
  for (const fileName of sortedFileNames) {
    const topLevel = fileName.split("/")[0];
    const remainder = fileName.split("/").slice(1).join("/");
    if (topLevelBuckets[topLevel] == null) {
      topLevelBuckets[topLevel] = [];
    }
    if (remainder !== "") {
      topLevelBuckets[topLevel].push(remainder);
    }
  }
  const result = {};
  for (const topLevel of Object.keys(topLevelBuckets)) {
    result[topLevel] = buildTree(topLevelBuckets[topLevel]);
  }
  return result;
}

function allSelectedFiles(filepath, data) {
  const fnames = Object.keys(data.file_to_commits);
  return fnames.filter((x) => x.startsWith(filepath))
}

function commitWeight(commit, file) {
  return Math.sqrt(commit.stats[file].lines);
}

function userWeightForFile(filePath, data){
  const commits = data.file_to_commits[filePath];
  const users_to_weight = {};
  for (const chash of commits) {
    const c = data.commits[chash];
    const w = commitWeight(c, filePath);
    if (users_to_weight[c.author] == null) {
      users_to_weight[c.author] = 0;
    }
    users_to_weight[c.author] += w;
  }
  return users_to_weight
}

class App extends Component {

  constructor() {
    super();
    this.state = {
      selectedFile: "",
      selectedUser: null,
    };
  }
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">SourceCred Explorer</h1>
        </header>
        <FileExplorer
          onSelectFile={(x) => this.setState({selectedFile: x})}
          selectedFile={this.state.selectedFile}
          data={data}
        />
        <UserExplorer
          selectedFile={this.state.selectedFile}
          selectedUser={this.state.selectedUser}
          onSelectUser={(x) => this.setState({selectedUser: x})}
          data={data}
        />
        <CommitExplorer
          selectedFile={this.state.selectedFile}
          selectedUser={this.state.selectedUser}
          data={data}
        />
      </div>
    );
  }
}

class FileExplorer extends Component {
  render() {
    const fileNames = Object.keys(this.props.data.file_to_commits).sort();
    const tree = buildTree(fileNames);

    return <div className="fileContainer" style={{
      marginLeft: 42,
      fontFamily: "monospace",
      textAlign: "left",
    }}>
      <FileEntry
        alwaysExpand={true}
        name=""
        tree={tree}
        onSelectFile={(x) => this.props.onSelectFile(x.slice(1))}
        selectedFile={this.props.selectedFile}
      />
    </div>
  }
}

class FileEntry extends Component {

  constructor() {
    super();
    this.state = {expanded: false,};
  }

  render() {
    const topLevels = Object.keys(this.props.tree);
    const subEntries = topLevels.map((x) =>
      <FileEntry
        key={x}
        name={x}
        alwaysExpand={false}
        tree={this.props.tree[x]}
        selectedFile={this.props.selectedFile}
        onSelectFile={(x) =>
          this.props.onSelectFile(`${this.props.name}/${x}`)
        }
      />
    )
    const isFolder = topLevels.length > 0 && !this.props.alwaysExpand;
    const toggleExpand = () => this.setState({expanded: !this.state.expanded});
    return <div style={{
      marginLeft: 25,
      backgroundColor: (this.props.name === this.props.selectedFile ? 'yellow' : 'white')
    }}>

      <p>
        {isFolder && <button
          style={{marginRight: 3}}
          onClick={toggleExpand}>»</button>}
        <span // TODO should be a button or <a> for accessibility
          style={{
          }}
          onClick={() => this.props.onSelectFile(this.props.name)}
          >{this.props.name}</span>
      </p>
      {(this.state.expanded || this.props.alwaysExpand) && subEntries}
    </div>
  }
}

class UserExplorer extends Component {

  render() {

    let files = allSelectedFiles(this.props.selectedFile, this.props.data);

    return <div />
  }
}

class CommitExplorer extends Component {
  render() {
    return <div />
  }
}

export default App;
