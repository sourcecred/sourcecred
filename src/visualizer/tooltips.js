// @flow

import React from "react";
import * as d3 from "d3";
import {StyleSheet, css} from "aphrodite/no-important";

import type {Point, PositionedNode, Size} from "./types";
import {color, BACKGROUND_COLOR} from "./constants";

const TOOLTIP_HORIZONTAL_OFFSET = 25;
const MAX_WIDTH = 200;
const VERTICAL_SAFETY_MARGIN = 150;

export type Props = {|
  +datum: PositionedNode,
  +containerSize: Size,
|};

/**
 * This class creates tooltips that overlay on top of the graph visualizer.
 *
 * The tooltips are created as a separate floating HTML component (as opposed to
 * embedded SVG) in the hope that this will be easier to maintain. Dealing with
 * text in SVG can be thorny.
 *
 * The task of creating these tooltips is complicated by the fact that we are
 * displaying user-provided data, so we can't really make assumptions that the
 * text will fit within any given pixel size.
 *
 * The approach is to create an inline-block div with a max-width
 * property. Inside the div, block elements contain all the individual pieces
 * of text (most notably the description).
 *
 * If the text can be displayed in fewer than MAX_WIDTH pixels, then that's great;
 * the tooltips will have a width below MAX_WIDTH and look clean.
 * If the text is larger than MAX_WIDTH, then the tooltips will inflate to exactly
 * MAX_WIDTH, and the text will wrap inside the tooltip.
 *
 * This may look a little funky (there is extra space on the right), but it's
 * the best we can do without implementing explicit text measurement and fiddling,
 * which I'd like to avoid for now.
 *
 * By default, the tooltip is positioned immediately to the right of the datum.
 * This could lead to the tooltip falling off the right edge of the screen. To
 * avoid this, we check when the tooltip could possibly exceed the right side of
 * the screen, and in that case, we shift it to the left of the datum instead.
 * We might want to effect that shift by moving the left edge of the tooltip,
 * but since we don't know the actual width of the tooltip in advance,
 * that would lead to the tooltip being unpredictably far away from the datum.
 * So we need to move the right edge of the tooltip instead.
 *
 * To ensure that works properly, we need to be able to position the tooltip
 * absolutely, and we need that absolute positioning to be relative to the
 * chart as a whole (rather than the entire window). So the tooltips must be
 * contained within a container div which has relative positioning, so as to
 * get the intended [containing block]. It's a little messy, but it works.
 *
 * [containing block]: https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block
 */
// STOPSHIP: Rename this file Tooltips
// STOPSHIP: Add a test plan
export class Tooltips extends React.Component<Props> {
  render() {
    const datum = this.props.datum;
    const {width, height} = this.props.containerSize;
    // Translate coordinate spaces (since the graphviz sets
    // 0,0 as the center of the svg)
    const offsetX = datum.position.x + width / 2;
    const xPosition = {};
    if (offsetX + TOOLTIP_HORIZONTAL_OFFSET + MAX_WIDTH < width) {
      // We don't risk the tooltip falling off the right side of the visualization
      // So we position it to the right of the datum
      xPosition["left"] = offsetX + TOOLTIP_HORIZONTAL_OFFSET + "px";
    } else {
      // The tooltip risks falling off the right side, so put it
      // on the left side instead.
      xPosition["right"] = width - offsetX + TOOLTIP_HORIZONTAL_OFFSET + "px";
    }
    const yPosition = {};
    const offsetY = datum.position.y + height / 2;
    if (offsetY + VERTICAL_SAFETY_MARGIN > height) {
      yPosition["bottom"] = -offsetY + "px";
    } else {
      yPosition["top"] = offsetY + "px";
    }
    const nodeColor = color(datum.node.scoreRatio);
    const displayScore = Math.floor(datum.node.score);
    return (
      <div
        className={css(styles.tooltips)}
        style={{
          color: nodeColor,
          borderColor: nodeColor,
          ...xPosition,
          ...yPosition,
        }}
      >
        <div className={css(styles.description)}>{datum.node.description}</div>
        <div className={css(styles.type)}>{datum.node.type}</div>
        <div className={css(styles.score)}>{displayScore}</div>
      </div>
    );
  }
}

const styles = StyleSheet.create({
  tooltips: {
    position: "absolute",
    border: "2px solid",
    borderRadius: "6px",
    display: "inline-block",
    maxWidth: `${MAX_WIDTH}px`,
    backgroundColor: BACKGROUND_COLOR,
    padding: "5px",
  },
  score: {},
  type: {fontSize: "0.7em"},
  description: {
    fontSize: "1.2em",
    overflowWrap: "break-word",
  },
});
