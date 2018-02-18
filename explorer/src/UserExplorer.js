// @flow
import React, { Component } from 'react';
import {commitWeight, userWeightForPath} from './commitUtils';
import type {CommitData, FileTree} from './commitUtils';

export class UserExplorer extends Component<{
  selectedPath: string,
  selectedUser: ?string,
  onSelectUser: (newUser: string) => void,
  data: CommitData,
}> {

  render() {
    const weights = userWeightForPath(this.props.selectedPath, this.props.data, commitWeight);
    const sortedUserWeightTuples =
        Object.keys(weights)
        .map(k => [k, weights[k]])
        .sort((a,b) => b[1] - a[1]);
    const entries = sortedUserWeightTuples.map(authorWeight => { 
      const [author, weight] = authorWeight;
      return <UserEntry userId={author} weight={weight} key={author}/>
    });
    return <div
      className="user-explorer plugin-pane"
    >
      <h3 style={{textAlign: "center"}}> User Explorer </h3>
      <div style={{marginLeft: 8, marginRight: 8}}>
        {entries}
      </div>
    </div>
  }

}

/**
 * Record the cred earned by the user in a given scope.
 */
class UserEntry extends Component<{
    userId: string,
    weight: number,
}> {

  render() {
    return <div className="user-entry">
      <span> {this.props.userId} </span>
      <span> {this.props.weight.toFixed(1)} </span>
    </div>
  }

}
