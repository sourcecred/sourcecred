import React, { Component } from 'react';
import {userWeightForPath, commitWeight} from './commitUtils';

export class UserExplorer extends Component {
  render() {
    const weights = userWeightForPath(this.props.selectedPath, this.props.data, commitWeight);
    const sortedUserWeightTuples = Object.entries(weights).sort((a,b) => b[1] - a[1]);
    const entries = sortedUserWeightTuples.map(authorWeight => { 
      const [author, weight] = authorWeight;
      return <UserEntry userId={author} weight={weight} key={author}/>
    });
    return <div className="user-explorer"> 
      <h3> User Explorer </h3> 
      {entries}
    </div>
  }
}

class UserEntry extends Component {
  // Record the cred earned by the user in a given scope
  // Props: 
  //  userId, string
  //  weight, number
  render() {
    return <div className="user-entry">
      <span> {this.props.userId} </span>
      <span> {this.props.weight.toFixed(1)} </span>
    </div>
  }
}
