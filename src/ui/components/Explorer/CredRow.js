// @flow
import React, {type Node as ReactNode} from "react";
import Markdown from "react-markdown";
import {Collapse, IconButton, TableCell, TableRow} from "@material-ui/core";
import {StyleSheet, css} from "aphrodite/no-important";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@material-ui/icons/KeyboardArrowUp";
import {format} from "d3-format";
import CredTimeline from "./CredTimeline";

type CredRowProps = {|
  +description: string | ReactNode,
  +depth: number,
  +indent: number,
  +cred: number,
  +total: number,
  +children: ReactNode,
  +data: $ReadOnlyArray<number> | null,
|};
type CredRowState = {|
  expanded: boolean,
|};
class CredRow extends React.Component<CredRowProps, CredRowState> {
  constructor(props: CredRowProps) {
    super(props);
    this.state = {expanded: false};
  }
  render() {
    const {
      children,
      total,
      cred,
      data,
      description,
      depth,
      indent,
    } = this.props;
    const {expanded} = this.state;
    const backgroundColor = `hsla(150,100%,28%,${1 - 0.9 ** depth})`;
    const makeGradient = (color) =>
      `linear-gradient(to top, ${color}, ${color})`;
    const normalBackground = makeGradient(backgroundColor);
    const highlightBackground = makeGradient("#494949");
    const backgroundImage = `${normalBackground}, ${highlightBackground}`;
    return (
      <>
        <TableRow
          style={{backgroundImage, marginLeft: depth * indent + 5}}
          className={css(styles.hoverHighlight)}
          onClick={() => {
            this.setState(({expanded}) => ({
              expanded: !expanded,
            }));
          }}
        >
          <TableCell>
            <IconButton
              aria-label="expand"
              color="primary"
              size="medium"
              style={{
                marginRight: 5,
                marginLeft: 15 * indent + 5,
              }}
              onClick={(e) => {
                e.stopPropagation();
                this.setState(({expanded}) => ({
                  expanded: !expanded,
                }));
              }}
            >
              {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>{" "}
            <Markdown
              renderers={{
                paragraph: "span",
                link: (props) => (
                  <a {...props} className={css(styles.customLink)} />
                ),
              }}
              source={description}
            />
          </TableCell>
          <TableCell className={css(styles.credCell)}>
            {format(".1d")(cred)}
          </TableCell>
          <TableCell className={css(styles.credCell)}>
            {format(".1%")(cred / total)}
          </TableCell>
          <TableCell>
            <CredTimeline data={data} />
          </TableCell>
        </TableRow>
        <Collapse in={expanded} timeout="auto" unmountOnExit></Collapse>
        {expanded ? children : null}
      </>
    );
  }
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
  customLink: {
    color: "cyan",
  },
  credCell: {textAlign: "right"},
});

export default CredRow;
