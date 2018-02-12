import * as React from 'react';
import { CommitData, buildTree, FileTree } from './commits';

interface FEProps {
  key: string;
  name: string;
  path: string;
  alwaysExpand: boolean;
  tree: FileTree;
  selectedPath: string;
  onSelectPath: (path: string) => void;
}

interface FEState {
  expanded: boolean;
}
class FileEntry extends React.Component<FEProps, FEState> {
  constructor(props: FEProps) {
    super(props);
    this.state = { expanded: false };
  }

  render(): any {
    // hackhack
    const topLevels = Object.keys(this.props.tree);
    const subEntries = topLevels.map(x => (
      <FileEntry
        key={x}
        name={x}
        path={`${this.props.path}/${x}`}
        alwaysExpand={false}
        tree={this.props.tree[x]}
        selectedPath={this.props.selectedPath}
        onSelectPath={this.props.onSelectPath}
      />
    ));
    const isFolder = topLevels.length > 0 && !this.props.alwaysExpand;
    const toggleExpand = () =>
      this.setState({ expanded: !this.state.expanded });
    const isSelected = this.props.path === this.props.selectedPath;
    const selectTarget = isSelected ? '.' : this.props.path;
    const onClick = () => this.props.onSelectPath(selectTarget);
    return (
      <div
        style={{ marginLeft: 25 }}
        className={isSelected ? 'selected-path' : ''}
      >
        <p>
          {isFolder && (
            <button style={{ marginRight: 3 }} onClick={toggleExpand}>
              »
            </button>
          )}
          <span // TODO should be a button or <a> for accessibility
            style={{}}
            onClick={onClick}
          >
            {this.props.name}
          </span>
        </p>
        {(this.state.expanded || this.props.alwaysExpand) && subEntries}
      </div>
    );
  }
}

interface FileExplorerProps {
  data: CommitData;
  onSelectPath: (path: string) => void;
  selectedPath: string;
}

export class FileExplorer extends React.Component<FileExplorerProps> {
  render() {
    const tree =
      this.props.data == null ? new Map() : buildTree(this.props.data);

    return (
      <div
        className="file-explorer"
        style={{
          fontFamily: 'monospace',
          textAlign: 'left'
        }}
      >
        <h3>File Explorer</h3>
        <FileEntry
          alwaysExpand={true}
          name=""
          path="."
          key=""
          tree={tree}
          onSelectPath={this.props.onSelectPath}
          selectedPath={this.props.selectedPath}
        />
      </div>
    );
  }
}
