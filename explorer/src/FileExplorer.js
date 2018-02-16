import React, { Component } from 'react';

export function buildTree(fileNames) {
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

export class FileExplorer extends Component {
  render() {
    const fileNames = Object.keys(this.props.data.fileToCommits).sort();
    const tree = buildTree(fileNames);
    const selectPath = (path) => {
      if (path.startsWith("./")) {
        path = path.slice(2);
      }
      this.props.onSelectPath(path);
    }
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
        onSelectPath={selectPath}
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
