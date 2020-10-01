// @flow

import React, {type Node as ReactNode} from "react";
import {Grid, Slider, Tooltip} from "@material-ui/core";

/**
 * The Weight that the user supplies via a WeightSlider.
 * Weights are finite and non-negative. The vast majority of weights cannot
 * be selected via the WeightSlider, which is only capable of choosing a few
 * specific weights.
 */
export type Weight = number;

/**
 * SliderPosition is an integer in the range `[MIN_SLIDER, MAX_SLIDER]` which
 * describes the current position of the WeightSlider's slider.
 */
export type SliderPosition = number;

export const MIN_SLIDER: SliderPosition = -5;
export const MAX_SLIDER: SliderPosition = 5;

export type Props = {|
  // The current Weight the WeightSlider is set to
  // Note: It is acceptable to pass the WeightSlider a weight which the slider
  // is incapable of picking (e.g. 1/3).
  +weight: Weight,
  // The name associated with the slider; displayed adjacent to the slider.
  +name: React$Node,
  // Callback invoked with the new weight after the user adjusts the slider.
  +onChange: (Weight) => void,
  +description: string,
|};

/**
 * The WeightSlider is a [controlled component] which lets the user choose a
 * numeric weight by dragging a slider.
 *
 * The weight varies exponentially in the slider position, so that moving the
 * slider by one notch changes the weight by a power of two. The exception is
 * when the user drags the slider to its minimum value, in which case the
 * weight is set to 0.
 *
 * In addition to rendering a slider (instantiated as a [range input]), it also renders
 * a description of the slider, and the weight associated with the current slider position.
 *
 * Note that it is possible to configure the WeightSlider with a weight that
 * that is impossible to select via the slider; for example, 1/3. In such cases,
 * the WeightSlider's slider will be set to the closest possible position, and after
 * the user adjusts the weight via the slider, it will always correspond exactly to
 * the slider position.
 *
 * [controlled component]: https://reactjs.org/docs/forms.html#controlled-components
 * [range input]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range
 */
export class WeightSlider extends React.Component<Props> {
  render(): ReactNode {
    return (
      <Tooltip title={this.props.description} placement="top">
        <Grid container justify="space-between">
          <Grid item xs={4}>
            {this.props.name}
          </Grid>
          <Grid item xs={5}>
            <Slider
              value={weightToSlider(this.props.weight)}
              min={MIN_SLIDER}
              max={MAX_SLIDER}
              step={1}
              valueLabelDisplay="off"
              onChange={(_, val) => {
                const weight: Weight = sliderToWeight(val);
                this.props.onChange(weight);
              }}
            />
          </Grid>
          <Grid item xs={1}>
            {formatWeight(this.props.weight)}
          </Grid>
        </Grid>
      </Tooltip>
    );
  }
}

/**
 * Converts a Weight into a SliderPosition.
 *
 * If the Weight is an illegal value (negative, NaN, or infinite), an error
 * will be thrown.
 *
 * It is possible that the Weight will be a legal value, but will not
 * correspond to any SliderPosition (as SliderPositions are always integers, in
 * the range `[MIN_SLIDER, MAX_SLIDER]`). In such cases, it may seem principled
 * to throw a conversion error. However, initial weights are provided by
 * plugins, and plugin authors might reasonably choose weights like 1/3 that do
 * not correspond to a slider value. We choose to make the WeightSlider robust
 * to such decisions by rounding to the closest appropriate slider position. In
 * such cases, the WeightSlider's weight will be inconsistent with the slider
 * position, and moving the Slider away from and back to its initial position
 * will actually change the weight. This is unfortunate, but is preferable to
 * having the application error.
 */
export function weightToSlider(weight: Weight): SliderPosition {
  if (!isFinite(weight) || weight < 0) {
    throw new Error(`illegal weight: ${weight}`);
  }
  const tentativePosition = Math.log2(weight);
  if (tentativePosition < MIN_SLIDER) {
    return MIN_SLIDER;
  }
  if (tentativePosition > MAX_SLIDER) {
    return MAX_SLIDER;
  }
  return Math.round(tentativePosition);
}

/**
 * Converts a SliderPosition into a Weight.
 *
 * SliderPosition must be an integer in the range `[MIN_SLIDER, MAX_SLIDER]`.
 * If it is not, then an error will be thrown.
 *
 * Over the domain of legal slider positions `p`, `weightToSlider(sliderToWeight(p))`
 * is the identity function.
 */
export function sliderToWeight(sliderPosition: SliderPosition): Weight {
  if (sliderPosition < MIN_SLIDER || sliderPosition > MAX_SLIDER) {
    throw new Error(`Slider position out of range: ${sliderPosition}`);
  }
  if (isNaN(sliderPosition)) {
    throw new Error("illegal value: NaN");
  }
  if (Math.round(sliderPosition) !== sliderPosition) {
    throw new Error(`slider position not integer: ${sliderPosition}`);
  }
  return sliderPosition === MIN_SLIDER ? 0 : 2 ** sliderPosition;
}

export function formatWeight(n: number): string {
  if (n < 0 || !isFinite(n)) {
    throw new Error(`Invalid weight: ${n}`);
  }
  if (n >= 1 || n === 0) {
    return n.toFixed(0) + "×";
  } else {
    return `1/${(1 / n).toFixed(0)}×`;
  }
}
