// @flow
import React from "react";
import {v4 as uuid} from "uuid";
import {
  AutocompleteArrayInput,
  List,
  Datagrid,
  DateField,
  DateInput,
  ArrayInput,
  BooleanField,
  NumberInput,
  TextField,
  SimpleForm,
  TextInput,
  Edit,
  Create,
  SimpleFormIterator,
  BooleanInput,
} from "react-admin";
import removeMd from "remove-markdown";
import {type AppState} from "../App";
import {type TimestampMs} from "../../util/timestamp";
import {type NodeAddressT} from "../../core/graph";
import {type InitiativeWeight} from "../../plugins/initiatives/initiative";
import {type NodeWeight} from "../../core/weights";

// TODO: create formal initiative type once shape is defined (see github PR #1864)
type InitiativeEntry = {|
  +id: string, // GUID
  +title: string,
  +timestampMs: TimestampMs,
  +weight: InitiativeWeight,
  +completed: boolean,
  // user nodes
  +champions: $ReadOnlyArray<NodeAddressT>,
  +dependencies: $ReadOnlyArray<NodeAddressT>,
  // an activity node
  +references: $ReadOnlyArray<NodeAddressT>,
  +contributions: $ReadOnlyArray<ContributionEntry>,
|};

type ContributionEntry = {|
  // GUID
  +key: string,
  // Title is required, as this is essential for attribution.
  +title: string,
  // Defaults to an empty array.
  +contributors: $ReadOnlyArray<NodeAddressT>,
  // Timestamp of this node, but in ISO format as it's more human friendly.
  +timestampMs: TimestampMs,
  // Defaults to null.
  +weight: NodeWeight,
|};

const jsonExporter = (initiatives: Object[]) => {
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

const getPlainDescFromMd = ({description}) => removeMd(description);

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

export const InitiativeCreate = (scData: AppState) => (props: Object) => {
  const defaultInitiativeValues = {
    id: uuid(),
    timestampMs: new Date(),
    champions: [],
    dependencies: [],
    references: [],
    contributions: [],
    weight: {incomplete: 0, complete: 0},
    completed: false,
  };
  const initiatives = scData.activities;
  console.log("props: ", props);
  return (
    <Create title="Create New Initiative" {...props}>
      <SimpleForm initialValues={defaultInitiativeValues}>
        <TextInput
          source="id"
          label="Initiative ID"
          disabled
          type="hidden"
          style={{display: "none"}}
        />
        <TextInput label="Title" source="title" />
        <DateInput label="Date" source="timestampMs" />
        <NumberInput
          label="Weight While Incomplete"
          source="weight.incomplete"
        />
        <NumberInput label="Weight When Completed" source="weight.complete" />
        <BooleanInput label="Completed" source="completed" />
        {/**/}
        <AutocompleteArrayInput
          source="champions"
          allowDuplicates={false}
          translateChoice={false}
          choices={scData.users}
          optionValue="address"
          optionText={getPlainDescFromMd}
          label="Champions"
          suggestionLimit={10}
        />
        <AutocompleteArrayInput
          source="dependencies"
          allowDuplicates={false}
          translateChoice={false}
          choices={initiatives}
          optionValue="address"
          optionText={getPlainDescFromMd}
          label="Dependencies"
          suggestionLimit={10}
        />
        <AutocompleteArrayInput
          source="references"
          allowDuplicates={false}
          translateChoice={false}
          choices={scData.activities}
          optionValue="address"
          optionText={getPlainDescFromMd}
          label="References"
          suggestionLimit={10}
        />
        {/**/}
        <ArrayInput label="Contributions" source="contributions">
          <SimpleFormIterator initialValues={{title: "poop"}}>
            <TextInput
              source="key"
              label="Contribution Key"
              disabled
              initialValue={uuid()}
              style={{display: "none"}}
            />
            <TextInput label="Contribution Name" source="title" />
            <DateInput label="Date" source="timestampMs" />
            <NumberInput label="Weight" source="weight" />
            <AutocompleteArrayInput
              source="contributors"
              parse={(v) => {
                return v;
              }}
              allowDuplicates={false}
              translateChoice={false}
              choices={scData.users}
              optionValue="address"
              optionText={getPlainDescFromMd}
              label="Contributors"
              suggestionLimit={10}
            />
          </SimpleFormIterator>
        </ArrayInput>
      </SimpleForm>
    </Create>
  );
};

export const InitiativeEdit = (scData: AppState) => (props: Object) => {
  console.log("props: ", props);
  const initiatives = scData.activities;
  return (
    <Edit title="Edit Initiative" {...props}>
      <SimpleForm>
        <TextInput label="Title" source="title" />
        <DateInput label="Date" source="timestampMs" />
        <NumberInput
          label="Weight While Incomplete"
          source="weight.incomplete"
        />
        <NumberInput label="Weight When Completed" source="weight.complete" />
        <BooleanInput label="Completed" source="completed" />
        {/**/}
        <AutocompleteArrayInput
          source="champions"
          allowDuplicates={false}
          translateChoice={false}
          choices={scData.users}
          optionValue="address"
          optionText={getPlainDescFromMd}
          label="Champions"
          suggestionLimit={10}
        />
        <AutocompleteArrayInput
          source="dependencies"
          allowDuplicates={false}
          translateChoice={false}
          choices={initiatives}
          optionValue="address"
          optionText={getPlainDescFromMd}
          label="Dependencies"
          suggestionLimit={10}
        />
        <AutocompleteArrayInput
          source="references"
          allowDuplicates={false}
          translateChoice={false}
          choices={scData.activities}
          optionValue="address"
          optionText={getPlainDescFromMd}
          label="References"
          suggestionLimit={10}
        />
        <ArrayInput label="Contributions" source="contributions">
          <SimpleFormIterator>
            <TextInput
              source="key"
              label="Contribution Key"
              disabled
              initialValue={uuid()}
              style={{display: "none"}}
            />
            <TextInput label="Contribution Name" source="title" />
            <DateInput label="Date" source="timestampMs" />
            <NumberInput label="Weight" source="weight" />
            <AutocompleteArrayInput
              source="contributors"
              allowDuplicates={false}
              translateChoice={false}
              choices={scData.users}
              optionValue="address"
              optionText={getPlainDescFromMd}
              label="Contributors"
              suggestionLimit={10}
            />
          </SimpleFormIterator>
        </ArrayInput>
      </SimpleForm>
    </Edit>
  );
};
