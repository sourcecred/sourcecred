// @flow

import React from "react";

export class WeightSlider extends React.Component<{|
  +weight: number,
  +name: string,
  +onChange: (number) => void,
|}> {
  render() {
    return (
      <label style={{display: "block"}}>
        <input
          type="range"
          min={-10}
          max={10}
          step={0.1}
          value={this.props.weight}
          onChange={(e) => {
            this.props.onChange(e.target.valueAsNumber);
          }}
        />{" "}
        <span>{formatWeight(this.props.weight)}</span>
        <span>{this.props.name}</span>
      </label>
    );
  }
}

export function formatWeight(n: number) {
  let x = n.toFixed(1);
  if (!x.startsWith("-")) {
    x = "+" + x;
  }
  return x.replace("-", "\u2212");
}
