// @flow
import React from "react";
import {List, Datagrid, DateField, BooleanField, TextField} from "react-admin";
import {jsonExporter} from "../../uiUtils";

export const InitiativeList = (props: Object) => {
  return (
    <List exporter={jsonExporter} {...props}>
      <Datagrid rowClick="edit">
        <TextField label="Initiative Name" source="title" />
        <BooleanField label="Completed" source="completed" />
        <DateField label="Last Updated" source="timestampMs" />
      </Datagrid>
    </List>
  );
};
