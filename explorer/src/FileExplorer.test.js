import {buildTree} from './FileExplorer';

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

