// @flow

import React, {type Node as ReactNode} from "react";
import type {IdentityId} from "../../../core/identity/identity";
import Tooltip from "@mui/material/Tooltip";
import Box from "@mui/material/Box";

const IdentityDetails = ({
  id,
  name,
}: {
  id: IdentityId,
  name: string,
}): ReactNode => {
  return (
    <Tooltip title={`ID: ${id}`} interactive placement="left">
      <Box mr={1}>{`${name}`}</Box>
    </Tooltip>
  );
};

export default IdentityDetails;
