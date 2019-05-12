// @flow

import {color} from "d3-color";
import {
  nodeRadius,
  nodeColor,
  MIN_COLOR,
  MAX_COLOR,
  MIN_RADIUS_PIXELS,
  MAX_RADIUS_PIXELS,
} from "./shared";

describe("visualizer/shared", () => {
  describe("nodeRadius", () => {
    it("handles boundary values appropriately", () => {
      expect(nodeRadius(0)).toEqual(MIN_RADIUS_PIXELS);
      expect(nodeRadius(1)).toEqual(MAX_RADIUS_PIXELS);
    });
    it("throws an error for invalid score ratios", () => {
      const bads = [Infinity, -Infinity, NaN, -0.1, 1.1];
      for (const bad of bads) {
        expect(() => nodeRadius(bad)).toThrowError("Invalid score ratio");
      }
    });
    it("interpolates according to the square root", () => {
      // Subtract out MIN_RADIUS_PIXELS because we are interpolating
      // only over the delta MAX_RADIUS_PIXELS - MIN_RADIUS_PIXELS
      const r4 = nodeRadius(0.4) - MIN_RADIUS_PIXELS;
      const r1 = nodeRadius(0.1) - MIN_RADIUS_PIXELS;
      expect(r4 / r1).toBeCloseTo(2);
    });
  });

  describe("nodeColor", () => {
    // I'm going to trust that d3.interpolate does the right thing,
    // so we're just checking that it's configured/wrapped properly.
    it("handles boundary values appropriately", () => {
      const toRGBString = (x) => color(x) + "";
      expect(nodeColor(0)).toEqual(toRGBString(MIN_COLOR));
      expect(nodeColor(1)).toEqual(toRGBString(MAX_COLOR));
    });
    it("throws an error for invalid score ratios", () => {
      const bads = [Infinity, -Infinity, NaN, -0.1, 1.1];
      for (const bad of bads) {
        expect(() => nodeColor(bad)).toThrowError("Invalid score ratio");
      }
    });
  });
});
