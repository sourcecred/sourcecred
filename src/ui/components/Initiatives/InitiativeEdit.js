// @flow
import React from "react";
import {Edit} from "react-admin";

import {CredView} from "../../../analysis/credView";
import {InitiativeForm} from "./InitiativeForm";

export const InitiativeEdit = (credView: CredView) => (props: Object) => {
  return (
    <Edit title="Edit Initiative" {...props}>
      <InitiativeForm credView={credView} />
    </Edit>
  );
};
