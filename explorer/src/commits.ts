
export interface CommitData {
  // TODO improve variable names
  file_to_commits: Map<string, string>;
  commits: Map<string, Commit>;
  authors: string[];
}

export function emptyCommitData(): CommitData {
  return {
    file_to_commits: new Map(),
    commits: new Map(),
    authors: [],
  };
}

export interface Commit {
  author: string;
  stats: Map<string, FileStats>;
}

export interface FileStats {
  lines: number;
  added: number;
  deleted: number;
}

function commitWeight(commit: Commit, filepath: string): number {
  return Math.sqrt(commit.stats[filepath].lines);
}

function allSelectedFiles(filepath: string, data: CommitData): string[] {
  const fnames = Object.keys(data.file_to_commits);
  return fnames.filter(x => x.startsWith(filepath));
}

function* userWeights(files: string[], data: CommitData): IterableIterator<[string, number]> {
  for (const file of files) {
    for (const commitHash of data.file_to_commits[file]) {
      const commit = data.commits[commitHash];
      const w = commitWeight(commit, file);
      yield [commit.author, w];
    }
  }
}

export function userWeightForPath(path: string, data: CommitData): Map<string, number> {
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

export type FileTree = Map<string, any>; // Map<string, FileTree>;

export function buildTree(data: CommitData): FileTree {
  const fileNames = Object.keys(data.file_to_commits).sort();
  return _buildTree(fileNames);
}

function _buildTree(fileNames: string[]): FileTree {
  const sortedFileNames = fileNames.slice().sort();
  const topLevelBuckets = new Map<string, string[]>();
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
  const result = new Map<string, FileTree>();
  for (const [topLevel, remainder] of topLevelBuckets) {
    result[topLevel] = _buildTree(remainder);
  }
  return result;
}
