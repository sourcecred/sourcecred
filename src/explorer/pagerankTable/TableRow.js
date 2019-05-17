// @flow

import React, {type Node as ReactNode} from "react";
import {StyleSheet, css} from "aphrodite/no-important";

type TableRowProps = {|
  // How many layers of nested scope we're in (changes the color)
  +depth: number,
  // How many steps to indent the row (shifts button right)
  +indent: number,
  // The node that goes in the Description column
  +description: ReactNode,

  // The content for the "multiuse column"
  // Could be a weight slider or a cred proportion depending on context.
  +multiuseColumn: ReactNode,
  // The cred amount to format and display
  +cred: number,
  // Children to show when the row is expanded
  +children: ReactNode,
  +showPadding: boolean,
|};
type TableRowState = {|
  expanded: boolean,
|};

export function credDisplay(cred: number) {
  return cred.toFixed(2);
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
      cred,
      children,
      showPadding,
      multiuseColumn,
    } = this.props;
    const {expanded} = this.state;
    const backgroundColor = `hsla(150,100%,28%,${1 - 0.9 ** depth})`;
    const makeGradient = (color) =>
      `linear-gradient(to top, ${color}, ${color})`;
    const normalBackground = makeGradient(backgroundColor);
    const highlightBackground = makeGradient("#D8E1E8");
    const backgroundImage = `${normalBackground}, ${highlightBackground}`;

    return (
      <React.Fragment>
        {showPadding && <PaddingRow backgroundColor={backgroundColor} />}
        <tr
          key="self"
          style={{backgroundImage}}
          className={css(styles.hoverHighlight)}
        >
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
          <td style={{textAlign: "right"}}>{multiuseColumn}</td>
          <td style={{textAlign: "right"}}>
            <span style={{marginRight: 5}}>{credDisplay(cred)}</span>
          </td>
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

const styles = StyleSheet.create({
  /* To apply 'hoverHighlight', provide a backgroundImage containing two <image>
 * data types (eg linear gradients). The first backgroundImage will be
 * the default background. The second backgroundImage will be applied on top
 * of the first background when the user hovers or tabs over the element.
 */

  hoverHighlight: {
    backgroundSize: "100% 100%, 0 0",
    ":hover": {
      backgroundSize: "100% 100%, 100% 100%",
    },
    ":focus-within": {
      backgroundSize: "100% 100%, 100% 100%",
    },
  },
});
