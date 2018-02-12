import * as React from 'react';
import { CommitData, userWeightForPath } from './commits';

interface UserExplorerProps {
  selectedPath: string;
  data: CommitData;
  selectedUser?: string;
  onSelectUser: (user: string) => void;
}

export class UserExplorer extends React.Component<UserExplorerProps> {
  render() {
    let weights = userWeightForPath(this.props.selectedPath, this.props.data);
    weights = weights; // TODO - use it
    return (
      <div className="user-explorer">
        {' '}
        <h3> User Explorer </h3>{' '}
      </div>
    );
  }
}
