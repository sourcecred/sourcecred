import React, { Component } from 'react';

function commitWeight(commit, file) {
  return Math.sqrt(commit.stats[file].lines);
}

function allSelectedFiles(filepath, data) {
  const fnames = Object.keys(data.file_to_commits);
  return fnames.filter((x) => x.startsWith(filepath))
}

function* userWeights(files, data) {
  for (const file of files) {
    for (const commitHash of data.file_to_commits[file]) {
      const commit = data.commits[commitHash];
      const w = commitWeight(commit, file);
      yield [commit.author, w];
    }
  }
}

function userWeightForPath(path, data) {
  const userWeightMap = new Map();
  const files = allSelectedFiles(path, data);
  for (const [user, weight] of userWeights(files, data)) {
    if (!userWeightMap.has(user)) {
      userWeightMap[user] = 0;
    }
    userWeightMap[user] += weight;
  }
  return userWeightMap;
}

export class UserExplorer extends Component {
  render() {
    let weights = userWeightForPath(this.props.selectedPath, this.props.data);

    return <div className="user-explorer"> <h3> User Explorer </h3> </div>
  }
}
