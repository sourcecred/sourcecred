// @flow
import React from "react";
import {List, Datagrid, DateField, BooleanField, TextField} from "react-admin";
import {type InitiativeEntry} from "../../initiativeUtils";

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

const jsonExporter = (initiatives: InitiativeEntry[]) => {
  const fakeLink = document.createElement("a");
  fakeLink.style.display = "none";
  if (!document.body) {
    console.error("Error: no DOM context to mount initiative download link");
    return;
  }
  document.body.appendChild(fakeLink);
  const initiativesToSave = {initiatives: initiatives};
  const blob = new Blob([JSON.stringify(initiativesToSave)], {
    type: "application/json",
  });
  if (window.navigator && window.navigator.msSaveOrOpenBlob) {
    // accomodate IE11+ & Edge
    window.navigator.msSaveOrOpenBlob(blob, `initiatives.json`);
  } else {
    fakeLink.setAttribute("href", URL.createObjectURL(blob));
    fakeLink.setAttribute("download", `initiatives.json`);
    fakeLink.click();
  }
  fakeLink.remove();
};
