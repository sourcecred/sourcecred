import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {buildTree} from './commitUtils';
import {propTypes as commitUtilsPropTypes} from './commitUtils';

export class FileExplorer extends Component {
  static propTypes = {
    selectedPath: PropTypes.string,
    onSelectPath: PropTypes.func.isRequired,
    data: commitUtilsPropTypes.commitData.isRequired,
  }

  render() {
    // within the FileExplorer, paths start with "./", outside they don't
    // which is hacky and should be cleaned up
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
        selectedPath={`./${this.props.selectedPath}`}
      />
    </div>
  }
}

class FileEntry extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    path: PropTypes.string.isRequired,
    alwaysExpand: PropTypes.bool.isRequired,

    // The type for the tree is recursive, and is annoying to specify as
    // a proptype. The Flow type definition is in commitUtils.js.
    tree: PropTypes.object.isRequired,

    selectedPath: PropTypes.string.isRequired,
    onSelectPath: PropTypes.func.isRequired,
  }

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
      />
    )
    const isFolder = topLevels.length > 0 && !this.props.alwaysExpand;
    const toggleExpand = () => this.setState({expanded: !this.state.expanded});
    const isSelected = this.props.path === this.props.selectedPath;
    const selectTarget = isSelected ? "." : this.props.path;
    const onClick = () => this.props.onSelectPath(selectTarget);
    return <div 
        className={isSelected ? 'selected-path' : ''}
        style={{marginLeft: this.props.path === "." ? 0 : 25}}
      >

      <p>
        {isFolder && <button
          style={{marginRight: 3}}
          onClick={toggleExpand}>»</button>}
        <a href="javascript: void 0" onClick={onClick}>{this.props.name}</a>
      </p>
      {(this.state.expanded || this.props.alwaysExpand) && subEntries}
    </div>
  }
}
