// @flow

import {interpolate} from "d3-interpolate";
import type {NodeAddressT} from "../core/graph";

/** Represents a position in the GraphVisualizer's display.
 *
 * The measurements are in pixels.
 * Standard SVG coordinates apply; (0,0) is the top left corner.
 */
export type Point = {|
  +x: number,
  +y: number,
|};

/**
 * Represents the size of the GraphVisualizer's display.
 *
 * The measurements are in pixels.
 */
export type Size = {|
  +height: number,
  +width: number,
|};

/**
 * The Node is the basic data structure that GraphVisualizer instantiators provide
 * as data about the nodes in the graph.
 *
 * Each Node has the information needed to display it (i.e. score, description, and
 * scoreRatio). The scoreRatio is provided separately from the score, as the same
 * score may have different significance in different contexts (is "50" a high score
 * or a low score?).
 *
 * In practice, the score is displayed as text, and the scoreRatio is used to set
 * attributes like color and radius.
 *
 * The Node does not include the position, because the GraphVisualizer assumes
 * responsibility for positioning nodes, so that the caller does not need to
 * worry about it.
 */
export type Node = {|
  +address: NodeAddressT,
  // Short string describing the type of the node.
  // May be changed to be a type descriptor object in the future.
  +type: string,
  // Score of the node.
  +score: number,
  // Score of the node as a fraction of the maximum score.
  // Allows scaling the nodes (in size, color) consistently.
  // Providing a score ratio outside of the domain [0, 1] is an error.
  +scoreRatio: number,
  // Human-readable description of the node. Plain text for now;
  // markdown may be supported later. Ideally, should not
  // be more than a sentance long.
  +description: string,
|};

/**
 * PositionedNode wraps a Node with a position in XY space.
 */
export type PositionedNode = {|
  +node: Node,
  +position: Point,
|};

export const BACKGROUND_COLOR = "#313131";

export const EDGE_COLOR = "steelblue";
export const EDGE_OPACITY = 0.6;

export const MIN_COLOR = "#00ABE1";
export const MAX_COLOR = "#90FF03";
export const MAX_RADIUS_PIXELS = 20;
export const MIN_RADIUS_PIXELS = 3;
export const TRANSITION_DURATION = 3000;

/**
 * Throws an error if the score ratio is not in the range [0, 1].
 */
function validate(scoreRatio: number): number {
  if (!isFinite(scoreRatio) || scoreRatio > 1 || scoreRatio < 0) {
    throw new Error(`Invalid score ratio: ${scoreRatio}`);
  }
  return scoreRatio;
}
/**
 * Set radius for a node based on the score ratio.
 *
 * The radius is proportional to the square root of the score ratio,
 * so that the area of a resultant circle will be linearly proportional.
 */
export function nodeRadius(scoreRatio: number): number {
  return (
    Math.sqrt(validate(scoreRatio)) * (MAX_RADIUS_PIXELS - MIN_RADIUS_PIXELS) +
    MIN_RADIUS_PIXELS
  );
}

/**
 * Sets the color for a node based on the score ratio.
 */
export function nodeColor(scoreRatio: number): string {
  return interpolate(MIN_COLOR, MAX_COLOR)(validate(scoreRatio));
}
