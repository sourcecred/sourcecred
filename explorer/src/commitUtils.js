// @flow

type CommitData = {
  // TODO improve variable names
  fileToCommits: {[filename: string]: string[]};
  commits: {[commithash: string]: Commit};
  authors: string[];
}

type Commit = {
  author: string;
  stats: {[filename: string]: FileStats};
}

type FileStats = {
  lines: number;
  added: number;
  deleted: number;
}

export function commitWeight(commit: Commit, filepath: string): number {
  // hack - GitPython encodes renames in the filepath. ignore for now.
  if (filepath.indexOf('=>') !== -1) {
    return 0;
  }
  return Math.sqrt(commit.stats[filepath].lines);
}

function allSelectedFiles(filepath: string, data: CommitData): string[] {
  const fnames = Object.keys(data.fileToCommits);
  return fnames.filter(x => x.startsWith(filepath));
}

function *userWeights(files: string[], data: CommitData, weightFn: WeightFn): Iterable<[string, number]> {
  for (const file of files) {
    for (const commitHash of data.fileToCommits[file]) {
      const commit = data.commits[commitHash];
      let w;
      if (commit.stats[file] == null) {
        // hack - likely due to the GitPython file rename issue
        console.log(`commit ${commitHash} missing file ${file}`);
        w = 0;
      } else {
        w = weightFn(commit, file);
      }
      yield [commit.author, w];
    }
  }
}

type WeightFn = (commit: Commit, filepath: string) => number;
export function userWeightForPath(path: string, data: CommitData, weightFn: WeightFn): {[string]: number} {
  const userWeightMap = {};
  const files = allSelectedFiles(path, data);
  for (const [user, weight] of userWeights(files, data, weightFn)) {
    if (userWeightMap[user] == null) {
      userWeightMap[user] = 0;
    }
    userWeightMap[user] += weight;
  }
  return userWeightMap;
}

type FileTree = {[string]: FileTree};

export function buildTree(fileNames: string[]): FileTree {
  const sortedFileNames = fileNames.slice().sort();
  return _buildTree(sortedFileNames);
}

function _buildTree(sortedFileNames: string[]): FileTree {
  const topLevelBuckets: {[root: string]: string[]} = {};
  for (const fileName of sortedFileNames) {
    const topLevel = fileName.split('/')[0];
    const remainder = fileName
      .split('/')
      .slice(1)
      .join('/');
    if (topLevelBuckets[topLevel] == null) {
      topLevelBuckets[topLevel] = [];
    }
    if (remainder !== '') {
      topLevelBuckets[topLevel].push(remainder);
    }
  }
  const result = {};
  for (const topLevel of Object.keys(topLevelBuckets)) {
    const remainders = topLevelBuckets[topLevel];
    result[topLevel] = _buildTree(remainders);
  }
  return result;
}
