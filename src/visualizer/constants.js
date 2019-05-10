// @flow

import * as d3 from "d3";

export const BACKGROUND_COLOR = "#313131";
export const HALO_COLOR = "#90FF03";

export const EDGE_COLOR = "steelblue";
export const EDGE_OPACITY = 0.6;

export const INTERPOLATE_LOW = "#00ABE1";
const INTERPOLATE_HIGH = "#90FF03";
const MAX_RADIUS_PIXELS = 20;
const MIN_RADIUS_PIXELS = 3;
export const TRANSITION_DURATION = 3000;

/*
 * Represents a particular score as a fraction of the maximum score in scope.
 * This allows us to calibrate display based on an expectation of how large
 * the maximum node should be, how it should be colored, etc.
 */
export type ScoreRatio = number;
export function radius(scoreRatio: number): number {
  return (
    Math.sqrt(scoreRatio) * (MAX_RADIUS_PIXELS - MIN_RADIUS_PIXELS) +
    MIN_RADIUS_PIXELS
  );
}

export function color(scoreRatio: number): string {
  return d3.interpolate(INTERPOLATE_LOW, INTERPOLATE_HIGH)(scoreRatio);
}
