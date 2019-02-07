// @flow

import React from "react";

/**
 * The Weight is the number that the WeightSlider actually provides to the
 * instantiating component. The Weight varies in the range
 * [0, 2**MAX_SLIDER_VALUE].
 */
export type Weight = number;

/**
 * The SliderPosition is the current position of the [range input] that the
 * WeightSlider instantiates. It varies in the range [MIN_SLIDER, MAX_SLIDER].
 *
 * [range input]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range
 *
 * The returned Weight is exponential in the SliderPosition, so that e.g. if
 * the SliderPosition is 2 then the Weight is 4, if the SliderPosition is 3
 * then the Weight is 8, and so forth. The exception is when the
 * SliderPosition==MIN_SLIDER_VALUE. In this case, the Weight will be 0.
 */
export type SliderPosition = number;

export const MIN_SLIDER: SliderPosition = -5;
export const MAX_SLIDER: SliderPosition = 5;

export type Props = {|
  // The current Weight the WeightSlider is set to
  +weight: Weight,
  // The name associated with the slider.
  // Will be displayed adjacent to the slider.
  +name: React$Node,
  // onChange handler so the parent can recieve (and then set) the new weight
  +onChange: (Weight) => void,
|};

/**
 * The WeightSlider is a React component for letting the user input
 * a numeric weight that varies over an exponential range.
 * The WeightSlider instantiates a slider that lets the user change
 * the weight, displays the current weight value, and displays
 * a "name" for the slider (which may be an arbitrary inline React
 * component).
 */
export class WeightSlider extends React.Component<Props> {
  render() {
    return (
      <label style={{display: "flex"}}>
        <span style={{flexGrow: 1}}>{this.props.name}</span>
        <input
          type="range"
          min={MIN_SLIDER}
          max={MAX_SLIDER}
          step={1}
          value={weightToSlider(this.props.weight)}
          onChange={(e) => {
            const weight: Weight = sliderToWeight(e.target.valueAsNumber);
            this.props.onChange(weight);
          }}
        />{" "}
        <span
          style={{minWidth: 45, display: "inline-block", textAlign: "right"}}
        >
          {formatWeight(this.props.weight)}
        </span>
      </label>
    );
  }
}

/**
 * Converts a Weight into a SliderPosition.
 *
 * If the Weight corresponds to an illegal slider value (i.e. weight < 0 or
 * weight > 2**MAX_SLIDER), then an error will be thrown.
 * be thrown.
 *
 * Over the domain of legal weights, `weightToSlider` and `sliderToWeight`
 * compose to form the identity function.
 */
export function weightToSlider(weight: Weight): SliderPosition {
  if (weight < 0 || weight > 2 ** MAX_SLIDER) {
    throw new Error(`Weight out of range: ${weight}`);
  }
  if (isNaN(weight)) {
    throw new Error("illegal value: NaN");
  }
  return Math.max(MIN_SLIDER, Math.log2(weight));
}

/**
 * Converts a SliderPosition into a Weight.
 *
 * If the SliderPosition is illegal (ie. not in the range [MIN_SLIDER,
 * MAX_SLIDER]), then an error will be thrown.
 *
 * Over the domain of legal slider positions, `sliderToWeight` and
 * `weightToSlider` compose to form the identity function.
 */
export function sliderToWeight(sliderPosition: SliderPosition): Weight {
  if (sliderPosition < MIN_SLIDER || sliderPosition > MAX_SLIDER) {
    throw new Error(`Slider position out of range: ${sliderPosition}`);
  }
  if (isNaN(sliderPosition)) {
    throw new Error("illegal value: NaN");
  }
  return sliderPosition === MIN_SLIDER ? 0 : 2 ** sliderPosition;
}

export function formatWeight(n: number) {
  if (n < 0 || !isFinite(n)) {
    throw new Error(`Invalid weight: ${n}`);
  }
  if (n >= 1 || n === 0) {
    return n.toFixed(0) + "×";
  } else {
    return `1/${(1 / n).toFixed(0)}×`;
  }
}
