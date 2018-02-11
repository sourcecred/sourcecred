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
      selectedPath: "",
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
          className="file-explorer"
          onSelectPath={(x) => this.setState({selectedPath: x})}
          selectedPath={this.state.selectedPath}
          data={data}
        />
        <UserExplorer
          className="user-explorer"
          selectedPath={this.state.selectedPath}
          selectedUser={this.state.selectedUser}
          onSelectUser={(x) => this.setState({selectedUser: x})}
          data={data}
        />
        <CommitExplorer
          selectedPath={this.state.selectedPath}
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

    return <div className="file-explorer" style={{
      fontFamily: "monospace",
      textAlign: "left",
    }}>
      <h3>File Explorer</h3>
      <FileEntry
        alwaysExpand={true}
        name=""
        path="."
        tree={tree}
        onSelectPath={this.props.onSelectPath}
        selectedPath={this.props.selectedPath}
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
        path={`${this.props.path}/${x}`}
        alwaysExpand={false}
        tree={this.props.tree[x]}
        selectedPath={this.props.selectedPath}
        onSelectPath={this.props.onSelectPath}
        style={{
          marginLeft: 25,
        }}
      />
    )
    const isFolder = topLevels.length > 0 && !this.props.alwaysExpand;
    const toggleExpand = () => this.setState({expanded: !this.state.expanded});
    const isSelected = this.props.path === this.props.selectedPath;
    const selectTarget = isSelected ? "." : this.props.path;
    const onClick = () => this.props.onSelectPath(selectTarget);
    return <div className={isSelected ? 'selected-path' : ''}>

      <p>
        {isFolder && <button
          style={{marginRight: 3}}
          onClick={toggleExpand}>»</button>}
        <span // TODO should be a button or <a> for accessibility
          style={{
          }}
          onClick={onClick}
          >{this.props.name}</span>
      </p>
      {(this.state.expanded || this.props.alwaysExpand) && subEntries}
    </div>
  }
}

class UserExplorer extends Component {

  render() {

    let files = allSelectedFiles(this.props.selectedPath, this.props.data);

    return <div className="user-explorer"> <h3> User Explorer </h3> </div>
  }
}

class CommitExplorer extends Component {
  render() {
    return <div />
  }
}

export default App;
