// @flow
import React from "react";
import {v4 as uuid} from "uuid";
import {Create, SimpleForm} from "react-admin";
import {CredView} from "../../../analysis/credView";
import {InitiativeForm} from "./InitiativeForm";

export const InitiativeCreate = (credView: CredView) => (props: Object) => {
  const defaultInitiativeValues = React.useMemo(
    () => ({
      id: uuid(),
      title: "",
      timestampMs: Date.now(),
      champions: [],
      dependencies: [],
      references: [],
      contributions: [],
      weight: {incomplete: 0, complete: 0},
      completed: false,
    }),
    []
  );

  return (
    <Create title="Create New Initiative" {...props}>
      <SimpleForm initialValues={defaultInitiativeValues}>
        <InitiativeForm credView={credView} />
      </SimpleForm>
    </Create>
  );
};
