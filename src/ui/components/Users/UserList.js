// @flow
import React from "react";
import {List, Datagrid, TextField} from "react-admin";
import {jsonExporter} from "../../uiUtils";

export const UserList = (props: Object) => {
  return (
    <List exporter={jsonExporter} {...props}>
      <Datagrid rowClick="edit">
        <TextField label="User Name" source="name" />
      </Datagrid>
    </List>
  );
};
