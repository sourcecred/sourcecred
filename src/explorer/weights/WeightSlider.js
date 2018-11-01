// @flow

import React from "react";

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
          min={-5}
          max={5}
          step={1}
          value={Math.log2(this.props.weight)}
          onChange={(e) => {
            const logValue = e.target.valueAsNumber;
            this.props.onChange(2 ** logValue);
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

export function formatWeight(n: number) {
  if (n <= 0 || !isFinite(n)) {
    throw new Error(`Invalid weight: ${n}`);
  }
  if (n >= 1) {
    return n.toFixed(0) + "×";
  } else {
    return `1/${(1 / n).toFixed(0)}×`;
  }
}
