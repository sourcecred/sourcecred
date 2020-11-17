// @flow

import {type PluckFn} from "../util/sortBy";
import sortBy from "../util/sortBy";
import cloneDeep from "lodash.clonedeep";

export const SortOrders = {
  ASCENDING: "ASCENDING",
  DESCENDING: "DESCENDING",
};
type SortOrderTypes = $Keys<typeof SortOrders>;

/**
  This is a utility for managing the state of sorted, filtered, and/or paginated
  table data on the front end.
 */
export class ArrayState<T> {
  _array: Array<T>;
  _filteredArray: Array<T>;
  _rowsPerPage: number;
  _sortArgs: ?[PluckFn<T>, SortOrderTypes];
  _filterFn: ?(T) => boolean;

  _pages(): number {
    return Math.ceil(
      this._filteredArray.length /
        Math.min(this._rowsPerPage, this._filteredArray.length)
    );
  }

  constructor(data: $ReadOnlyArray<T>) {
    this.setData(data);
    this._rowsPerPage = +Infinity;
  }

  /**
    data: a new baseline data set. Existing transformations will be applied.
    return: the new number of pages
   */
  setData(data: $ReadOnlyArray<T>): number {
    this._array = cloneDeep(data);
    return this._filterFn ? this.filter(this._filterFn) : this.filter();
  }

  /**
    pluckArg: a function of an object that returns the element by which to sort
    order: "ASCENDING" or "DESCENDING"
   */
  sortBy(pluckArg: PluckFn<T>, order: SortOrderTypes) {
    this._filteredArray = sortBy(this._filteredArray, pluckArg);
    if (order === SortOrders.DESCENDING) {
      this._filteredArray.reverse();
    }
    this._sortArgs = [pluckArg, order];
  }

  /**
    Removes any existing filters and applies the new filter if provided.

    filterFn: a function that returns true for objects that should be included, omit to remove filter
    return: the new number of pages
   */
  filter(filterFn?: (T) => boolean): number {
    this._filterFn = filterFn;
    this._filteredArray = filterFn ? this._array.filter(filterFn) : this._array;
    if (this._sortArgs) this.sortBy(...this._sortArgs);
    return this._pages();
  }

  /**
    rowsPerPage: how many rows should be displayed per page, +Infinity to display all rows on one page
    return: the new number of pages
   */
  setRowsPerPage(rowsPerPage: number): number {
    if (rowsPerPage !== parseInt(rowsPerPage) && rowsPerPage !== +Infinity)
      throw "rowsPerPage must be an integer";
    if (rowsPerPage < 1) throw "rowsPerPage must be at least 1";
    this._rowsPerPage = rowsPerPage;
    return this._pages();
  }

  /**
    Get the total number of pages.
   */
  getPageCount(): number {
    return this._pages();
  }

  /**
    Get the contents of the specified page.
   */
  getPage(pageNumber: number): $ReadOnlyArray<T> {
    if (pageNumber !== parseInt(pageNumber))
      throw "pageNumber must be an integer";
    if (pageNumber < 1 || pageNumber > this._pages())
      throw "Invalid page number. Use an integer in the range [1, pageCount].";
    const startIndex =
      Math.min(this._rowsPerPage, this._filteredArray.length) *
      (pageNumber - 1);
    const endIndex =
      Math.min(this._rowsPerPage, this._filteredArray.length) + startIndex;
    return this._filteredArray.slice(startIndex, endIndex);
  }
}
