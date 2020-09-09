// @flow
import React, {type Node as ReactNode, useState} from "react";
import Markdown from "react-markdown";
import {IconButton, TableCell, TableRow} from "@material-ui/core";
import {makeStyles} from "@material-ui/core/styles";
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

const useStyles = makeStyles({
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
  credCell: {textAlign: "right"},
});

const CredRow = (props: CredRowProps) => {
  const {children, total, cred, data, description, depth, indent} = props;
  const classes = useStyles();
  const [expanded, setExpanded] = useState(false);
  const backgroundColor = `hsla(150,100%,28%,${1 - 0.9 ** depth})`;
  const makeGradient = (color) => `linear-gradient(to top, ${color}, ${color})`;
  const normalBackground = makeGradient(backgroundColor);
  const highlightBackground = makeGradient("#D8E1E8");
  const backgroundImage = `${normalBackground}, ${highlightBackground}`;
  return (
    <>
      <TableRow
        style={{backgroundImage, marginLeft: depth * indent + 5}}
        className={classes.hoverHighlight}
        onClick={() => setExpanded(!expanded)}
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
              setExpanded(!expanded);
            }}
          >
            {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
          <Markdown renderers={{paragraph: "span"}} source={description} />{" "}
        </TableCell>
        <TableCell className={classes.credCell}>
          {format(".1d")(cred)}
        </TableCell>
        <TableCell className={classes.credCell}>
          {format(".1%")(cred / total)}
        </TableCell>
        <TableCell>
          <CredTimeline data={data} />
        </TableCell>
      </TableRow>
      {expanded ? children : null}
    </>
  );
};

export default CredRow;
