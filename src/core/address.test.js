// @flow

import sortBy from "lodash.sortby";
import stringify from "json-stable-stringify";

import type {Address} from "./address";
import {AddressMap, fromString, toString} from "./address";

describe("address", () => {
  // Some test data using objects that have addresses, like houses.
  type House = {|
    +address: Address,
    +beds: number,
    +baths: number,
  |};
  function makeAddress(type: "HOME" | "BUSINESS", id: string): Address {
    return {
      repositoryName: "sourcecred/suburbia",
      pluginName: "houseville",
      id,
      type,
    };
  }
  const mansion = (): House => ({
    address: makeAddress("HOME", "mansion"),
    beds: 10,
    baths: 5,
  });
  const fakeMansion = (): House => ({
    // Same address, different content.
    address: makeAddress("HOME", "mansion"),
    beds: 33,
    baths: 88,
  });
  const mattressStore = (): House => ({
    address: makeAddress("BUSINESS", "mattressStore"),
    beds: 99,
    baths: 1,
  });

  describe("AddressMap", () => {
    const makeMap = (): AddressMap<House> =>
      new AddressMap().add(mansion()).add(mattressStore());

    it("creates a simple map", () => {
      makeMap();
    });

    it("gets objects by key", () => {
      expect(makeMap().get(mansion().address)).toEqual(mansion());
      expect(makeMap().get(mattressStore().address)).toEqual(mattressStore());
    });

    it("gets all objects, in some order", () => {
      const actual = makeMap().getAll();
      const expected = [mansion(), mattressStore()];
      const sort = (xs) => sortBy(xs, (x) => stringify(x.address));
      expect(sort(actual)).toEqual(sort(expected));
    });

    it("removes objects by key", () => {
      expect(
        makeMap()
          .remove(mansion().address)
          .get(mansion().address)
      ).toBeUndefined();
    });

    it("stringifies to JSON", () => {
      expect(makeMap().toJSON()).toMatchSnapshot();
    });

    it("stringifies elements sans addresses", () => {
      const json = makeMap().toJSON();
      Object.keys(json).forEach((k) => {
        const value = json[k];
        expect(Object.keys(value).sort()).toEqual(["baths", "beds"]);
      });
    });

    it("rehydrates elements with addresses", () => {
      const newMap: AddressMap<House> = AddressMap.fromJSON(makeMap().toJSON());
      newMap.getAll().forEach((house) => {
        expect(Object.keys(house).sort()).toEqual(["address", "baths", "beds"]);
      });
    });

    it("preserves equality over a JSON roundtrip", () => {
      const result = AddressMap.fromJSON(makeMap().toJSON());
      expect(result.equals(makeMap())).toBe(true);
    });

    it("recognizes reference equality", () => {
      const x = makeMap();
      expect(x.equals(x)).toBe(true);
    });

    it("recognizes deep equality", () => {
      expect(makeMap().equals(makeMap())).toBe(true);
    });

    it("recognizes equality invariant of construction order", () => {
      const m1 = new AddressMap().add(mansion()).add(mattressStore());
      const m2 = new AddressMap().add(mattressStore()).add(mansion());
      expect(m1.equals(m2)).toBe(true);
      expect(m2.equals(m1)).toBe(true);
    });

    it("recognizes disequality when element lists differ", () => {
      expect(makeMap().equals(new AddressMap())).toBe(false);
      expect(new AddressMap().equals(makeMap())).toBe(false);
    });

    it("recognizes disequality when contents differ", () => {
      const m1 = new AddressMap().add(mattressStore()).add(mansion());
      const m2 = new AddressMap().add(mattressStore()).add(fakeMansion());
      expect(m1.equals(m2)).toBe(false);
      expect(m2.equals(m1)).toBe(false);
    });

    describe("has nice error messages", () => {
      [null, undefined].forEach((bad) => {
        it(`when getting ${String(bad)} elements`, () => {
          const message = `address is ${String(bad)}`;
          expect(() => makeMap().get((bad: any))).toThrow(message);
        });
        it(`when removing ${String(bad)} elements`, () => {
          const message = `address is ${String(bad)}`;
          expect(() => makeMap().remove((bad: any))).toThrow(message);
        });
        it(`when adding elements with ${String(bad)} address`, () => {
          const message = `address is ${String(bad)}`;
          const element = {
            address: (bad: any),
            beds: 23,
            baths: 45,
          };
          expect(() => makeMap().add(element)).toThrow(message);
        });
      });
    });
  });

  describe("toString and fromString", () => {
    const examples = () => [mansion(), fakeMansion(), mattressStore()];
    it("simple round trips work", () => {
      examples().forEach((x) => {
        expect(x.address).toEqual(fromString(toString(x.address)));
      });
    });
    it("serialization looks good in snapshot review", () => {
      const serialized = examples().map((x) => [
        x.address,
        toString(x.address),
      ]);
      expect(serialized).toMatchSnapshot();
    });
    it("Order of insertion does not matter", () => {
      const a1 = {
        pluginName: "foo",
        type: "bar",
        id: "zoombat",
        repositoryName: "oregano",
      };
      const a2 = {
        id: "zoombat",
        type: "bar",
        repositoryName: "oregano",
        pluginName: "foo",
      };
      expect(toString(a1)).toEqual(toString(a2));
    });
  });
});
