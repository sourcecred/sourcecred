// @flow
import React from "react";
import {v4 as uuid} from "uuid";
import {
  AutocompleteArrayInput,
  DateInput,
  ArrayInput,
  NumberInput,
  SimpleForm,
  TextInput,
  Edit,
  SimpleFormIterator,
  BooleanInput,
} from "react-admin";
import {
  getPlainDescFromMd,
  dateFormatter,
  dateParser,
} from "../../initiativeUtils";

import {type AppState} from "../InitiativesEditor";

export const InitiativeEdit = (scData: AppState) => (props: Object) => {
  const initiatives = scData.activities;
  return (
    <Edit title="Edit Initiative" {...props}>
      <SimpleForm>
        <TextInput label="Title" source="title" />
        <DateInput
          format={dateFormatter}
          parse={dateParser}
          label="Date"
          source="timestampMs"
        />
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
            <DateInput
              format={dateFormatter}
              parse={dateParser}
              label="Date"
              source="timestampMs"
            />
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
