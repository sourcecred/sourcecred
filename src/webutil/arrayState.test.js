// @flow

import {ArrayState, SortOrders} from "./arrayState";

describe("src/webutil/arrayState", () => {
  describe("when the type is an object", () => {
    let arrayState;
    beforeEach(() => {
      const array = [
        {num: 3, str: "3"},
        {num: 1, str: "1"},
        {num: 2, str: "2"},
        {num: 4, str: "4"},
        {num: 5, str: "5"},
      ];
      arrayState = new ArrayState(array);
    });

    describe(".getPage", () => {
      it("returns the original array after instantiation", () => {
        expect(arrayState.getPage(1)).toEqual([
          {num: 3, str: "3"},
          {num: 1, str: "1"},
          {num: 2, str: "2"},
          {num: 4, str: "4"},
          {num: 5, str: "5"},
        ]);
        expect(arrayState.getPageCount()).toEqual(1);
      });

      it("should throw if an invalid page number is provided", () => {
        expect(() => arrayState.getPage(2)).toThrow("Invalid page number");
        expect(() => arrayState.getPage(0)).toThrow("Invalid page number");
      });

      it("should throw for non-integer values", () => {
        expect(() => arrayState.getPage(1.2)).toThrow("must be an integer");
      });
    });

    describe(".setRowsPerPage", () => {
      it("should work with one record per page", () => {
        expect(arrayState.setRowsPerPage(1)).toEqual(5);
        expect(arrayState.getPage(2)).toEqual([{num: 1, str: "1"}]);
      });

      it("should create no less that 1 page", () => {
        expect(arrayState.setRowsPerPage(5)).toEqual(1);
        expect(arrayState.setRowsPerPage(+Infinity)).toEqual(1);
        expect(arrayState.setRowsPerPage(10)).toEqual(1);
      });

      it("should handle partial pages", () => {
        expect(arrayState.setRowsPerPage(4)).toEqual(2);
        expect(arrayState.getPageCount()).toEqual(2);
        expect(arrayState.getPage(1)).toEqual([
          {num: 3, str: "3"},
          {num: 1, str: "1"},
          {num: 2, str: "2"},
          {num: 4, str: "4"},
        ]);
        expect(arrayState.getPage(2)).toEqual([{num: 5, str: "5"}]);
      });

      it("should throw for non-integer values", () => {
        expect(() => arrayState.setRowsPerPage(4.2)).toThrow(
          "must be an integer"
        );
      });

      it("should throw for values under 1", () => {
        expect(() => arrayState.setRowsPerPage(0)).toThrow(
          "must be at least 1"
        );
      });
    });

    describe(".sort", () => {
      it("should sort number fields descending", () => {
        arrayState.sortBy((x) => x.num, SortOrders.DESCENDING);
        expect(arrayState.getPage(1)).toEqual([
          {num: 5, str: "5"},
          {num: 4, str: "4"},
          {num: 3, str: "3"},
          {num: 2, str: "2"},
          {num: 1, str: "1"},
        ]);
      });

      it("should sort string fields descending", () => {
        arrayState.sortBy((x) => x.str, SortOrders.DESCENDING);
        expect(arrayState.getPage(1)).toEqual([
          {num: 5, str: "5"},
          {num: 4, str: "4"},
          {num: 3, str: "3"},
          {num: 2, str: "2"},
          {num: 1, str: "1"},
        ]);
      });

      it("should sort number fields ascending", () => {
        arrayState.sortBy((x) => x.num, SortOrders.ASCENDING);
        expect(arrayState.getPage(1)).toEqual([
          {num: 1, str: "1"},
          {num: 2, str: "2"},
          {num: 3, str: "3"},
          {num: 4, str: "4"},
          {num: 5, str: "5"},
        ]);
      });

      it("should sort string fields ascending", () => {
        arrayState.sortBy((x) => x.str, SortOrders.ASCENDING);
        expect(arrayState.getPage(1)).toEqual([
          {num: 1, str: "1"},
          {num: 2, str: "2"},
          {num: 3, str: "3"},
          {num: 4, str: "4"},
          {num: 5, str: "5"},
        ]);
      });
    });

    describe(".filter", () => {
      it("should filter and update page count", () => {
        expect(arrayState.filter((x) => x.num > 1)).toEqual(1);
        expect(arrayState.getPage(1)).toEqual([
          {num: 3, str: "3"},
          {num: 2, str: "2"},
          {num: 4, str: "4"},
          {num: 5, str: "5"},
        ]);
      });

      it("should remove filter if no parameter is provided", () => {
        expect(arrayState.filter((x) => x.num > 1)).toEqual(1);
        expect(arrayState.filter()).toEqual(1);
        expect(arrayState.getPage(1)).toEqual([
          {num: 3, str: "3"},
          {num: 1, str: "1"},
          {num: 2, str: "2"},
          {num: 4, str: "4"},
          {num: 5, str: "5"},
        ]);
      });
    });

    describe("chaining commands", () => {
      it("should apply each transformation while maintaining other transformations", () => {
        expect(arrayState.filter((x) => x.num > 1)).toEqual(1);
        expect(arrayState.getPage(1)).toEqual([
          {num: 3, str: "3"},
          {num: 2, str: "2"},
          {num: 4, str: "4"},
          {num: 5, str: "5"},
        ]);

        arrayState.sortBy((x) => x.num, SortOrders.ASCENDING);
        expect(arrayState.getPage(1)).toEqual([
          {num: 2, str: "2"},
          {num: 3, str: "3"},
          {num: 4, str: "4"},
          {num: 5, str: "5"},
        ]);

        expect(arrayState.filter((x) => x.num < 5)).toEqual(1);
        expect(arrayState.getPage(1)).toEqual([
          {num: 1, str: "1"},
          {num: 2, str: "2"},
          {num: 3, str: "3"},
          {num: 4, str: "4"},
        ]);

        expect(arrayState.setRowsPerPage(2)).toEqual(2);
        expect(arrayState.getPage(1)).toEqual([
          {num: 1, str: "1"},
          {num: 2, str: "2"},
        ]);

        arrayState.sortBy((x) => x.num, SortOrders.DESCENDING);
        expect(arrayState.getPage(1)).toEqual([
          {num: 4, str: "4"},
          {num: 3, str: "3"},
        ]);

        expect(arrayState.filter((x) => x.num > 2)).toEqual(2);
        expect(arrayState.getPage(1)).toEqual([
          {num: 5, str: "5"},
          {num: 4, str: "4"},
        ]);
        expect(arrayState.getPage(2)).toEqual([{num: 3, str: "3"}]);

        expect(
          arrayState.setData([
            {num: 3, str: "3"},
            {num: 1, str: "1"},
            {num: 2, str: "2"},
            {num: 4, str: "4"},
            {num: 5, str: "5"},
            {num: 6, str: "6"},
            {num: 7, str: "7"},
          ])
        ).toEqual(3);
        expect(arrayState.getPage(1)).toEqual([
          {num: 7, str: "7"},
          {num: 6, str: "6"},
        ]);

        expect(arrayState.setRowsPerPage(+Infinity)).toEqual(1);
        expect(arrayState.getPage(1)).toEqual([
          {num: 7, str: "7"},
          {num: 6, str: "6"},
          {num: 5, str: "5"},
          {num: 4, str: "4"},
          {num: 3, str: "3"},
        ]);

        expect(arrayState.filter()).toEqual(1);
        expect(arrayState.getPage(1)).toEqual([
          {num: 7, str: "7"},
          {num: 6, str: "6"},
          {num: 5, str: "5"},
          {num: 4, str: "4"},
          {num: 3, str: "3"},
          {num: 2, str: "2"},
          {num: 1, str: "1"},
        ]);
      });
    });
  });
});
