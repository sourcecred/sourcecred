// @flow

import React from "react";

function assertValidDirectionality(x: number) {
  if (x < 0 || x > 1) {
    throw new Error(
      `directionality out of bounds: ${x} must be between 0 and 1`
    );
  }
}

export class DirectionalitySlider extends React.Component<{|
  +directionality: number,
  +name: string,
  +onChange: (number) => void,
|}> {
  render() {
    assertValidDirectionality(this.props.directionality);
    return (
      <label style={{display: "block"}}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={this.props.directionality}
          onChange={(e) => {
            const value = e.target.valueAsNumber;
            assertValidDirectionality(value);
            this.props.onChange(value);
          }}
        />
        <span>{this.props.directionality.toFixed(2)}</span>
        <span>{this.props.name}</span>
      </label>
    );
  }
}
