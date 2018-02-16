// @flow
import {userWeightForPath, buildTree} from './commitUtils';

const exampleData = {
  fileToCommits: {
    'foo.txt': ['1'],
    'bar.txt': ['1', '2']
  },
  commits: {
    '1': {
      'author': 'dandelionmane',
      'stats': {
        'foo.txt': {'lines': 5, 'added': 3, 'deleted': 2},
        'bar.txt': {'lines': 100, 'added': 100, 'deleted': 0}
        }
      },
    '2': {
      'author': 'wchargin',
      'stats': {
      'bar.txt': {'lines': 100, 'added': 50, 'deleted': 50},
        }
      },
  },
  authors: ['dandelionmane', 'wchargin']
}

const emptyData = {fileToCommits: {}, commits: {}, authors: []};

function weightByNumFilesTouched(commit, filepath) {
  return 1;
}

describe('userWeightForPath', () => {
  it('works on empty data', () => {
    const actual = userWeightForPath('', emptyData, weightByNumFilesTouched);
    const expected = {};
    expect(actual).toEqual(expected);
  });

  it('works in simple case', () => {
    const actual = userWeightForPath('', exampleData, weightByNumFilesTouched);
    const expected = {'dandelionmane': 2, 'wchargin': 1};
    expect(actual).toEqual(expected);
  });

  it('respects file paths', () => {
    const actual = userWeightForPath('bar.txt', exampleData, weightByNumFilesTouched);
    const expected = {'dandelionmane': 1, 'wchargin': 1};
    expect(actual).toEqual(expected);
  });

  it('uses custom weight function', () => {
    const myWeight = (commit, filepath) => commit.stats[filepath].lines;
    const actual = userWeightForPath('', exampleData, myWeight);
    const expected = {'dandelionmane': 105, 'wchargin': 100};
    expect(actual).toEqual(expected);
  })
})

describe('buildTree', () => {
  it('handles empty tree', () => {
    expect(buildTree([])).toEqual({});
  });

  it('handles trees', () => {
    const names = ['foo', 'bar/zod', 'bar/zoink'];
    const expected = {'foo': {}, 'bar': {'zod': {}, 'zoink': {}}};
    expect(buildTree(names)).toEqual(expected);
  });
});
