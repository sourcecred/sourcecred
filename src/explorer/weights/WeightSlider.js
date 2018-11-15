// @flow

import React from "react";

export const WEIGHT_SLIDER_MIN = -5;
export const WEIGHT_SLIDER_MAX = 5;

export type Props = {|
  +weight: number,
  +name: React$Node,
  +onChange: (number) => void,
|};
export class WeightSlider extends React.Component<Props> {
  render() {
    return (
      <label style={{display: "flex"}}>
        <span style={{flexGrow: 1}}>{this.props.name}</span>
        <input
          type="range"
          min={WEIGHT_SLIDER_MIN}
          max={WEIGHT_SLIDER_MAX}
          step={1}
          value={convertWeightToSliderValue(this.props.weight)}
          onChange={(e) => {
            const sliderValue = convertSliderValueToWeight(
              e.target.valueAsNumber
            );
            this.props.onChange(sliderValue);
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

function convertWeightToSliderValue(weight: number): number {
  return weight === 0 ? WEIGHT_SLIDER_MIN : Math.log2(weight);
}

function convertSliderValueToWeight(sliderValue: number): number {
  return sliderValue === WEIGHT_SLIDER_MIN ? 0 : 2 ** sliderValue;
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
