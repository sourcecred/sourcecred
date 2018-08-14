// @flow

import React, {type Node as ReactNode} from "react";

type TableRowProps = {|
  // How many layers of nested scope we're in (changes the color)
  +depth: number,
  // How many steps to indent the row (shifts button right)
  +indent: number,
  // The node that goes in the Description column
  +description: ReactNode,
  // What proportion should be formatted in the connection column
  +connectionProportion: ?number,
  // The score to format and display
  +score: number,
  // Children to show when the row is expanded
  +children: ReactNode,
  +showPadding: boolean,
|};
type TableRowState = {|
  expanded: boolean,
|};

export function scoreDisplay(score: number) {
  return score.toFixed(2);
}

export class TableRow extends React.PureComponent<
  TableRowProps,
  TableRowState
> {
  constructor() {
    super();
    this.state = {expanded: false};
  }
  render() {
    const {
      depth,
      indent,
      description,
      connectionProportion,
      score,
      children,
      showPadding,
    } = this.props;
    const {expanded} = this.state;
    const percent =
      connectionProportion == null
        ? ""
        : (connectionProportion * 100).toFixed(2) + "%";
    const backgroundColor = `hsla(150,100%,28%,${1 - 0.9 ** depth})`;
    return (
      <React.Fragment>
        {showPadding && <PaddingRow backgroundColor={backgroundColor} />}
        <tr key="self" style={{backgroundColor}}>
          <td style={{display: "flex", alignItems: "flex-start"}}>
            <button
              style={{
                marginRight: 5,
                marginLeft: 15 * indent + 5,
              }}
              onClick={() => {
                this.setState(({expanded}) => ({
                  expanded: !expanded,
                }));
              }}
            >
              {expanded ? "\u2212" : "+"}
            </button>
            {description}
          </td>
          <td style={{textAlign: "right"}}>{percent}</td>
          <td style={{textAlign: "right"}}>{scoreDisplay(score)}</td>
        </tr>
        {expanded && children}
        {showPadding && <PaddingRow backgroundColor={backgroundColor} />}
      </React.Fragment>
    );
  }
}

export function PaddingRow(props: {|+backgroundColor: string|}) {
  return (
    <tr
      style={{
        height: 12,
        backgroundColor: props.backgroundColor,
      }}
    >
      <td />
      <td />
      <td />
    </tr>
  );
}
