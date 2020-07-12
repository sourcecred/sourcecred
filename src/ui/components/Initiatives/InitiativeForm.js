// @flow
import type {InitiativeEntry} from "../../initiativeUtils";
import {
  dateFormatter,
  dateParser,
  getPlainDescFromMd,
} from "../../initiativeUtils";
import {v4 as uuid} from "uuid";

import {CredView} from "../../../analysis/credView";
import React from "react";
import {
  ArrayInput,
  AutocompleteArrayInput,
  BooleanInput,
  DateInput,
  NumberInput,
  SimpleForm,
  SimpleFormIterator,
  TextInput,
} from "react-admin";

type InitiativeFormProps = {|
  initialValues?: InitiativeEntry,
  credView: CredView,
|};
export const InitiativeForm = ({
  credView,
  initialValues,
}: InitiativeFormProps) => {
  const allNodes = React.useMemo(() => credView.nodes(), [credView]);
  const userNodes = React.useMemo(() => credView.userNodes(), [credView]);
  return (
    <SimpleForm initialValues={initialValues}>
      <TextInput
        source="id"
        label="Initiative ID"
        disabled
        type="hidden"
        style={{display: "none"}}
      />
      <TextInput label="Title" source="title" />
      <DateInput
        format={dateFormatter}
        parse={dateParser}
        label="Date"
        source="timestampMs"
      />
      <NumberInput label="Weight While Incomplete" source="weight.incomplete" />
      <NumberInput label="Weight When Completed" source="weight.complete" />
      <BooleanInput label="Completed" source="completed" />
      <AutocompleteArrayInput
        source="champions"
        allowDuplicates={false}
        translateChoice={false}
        choices={userNodes}
        optionValue="address"
        optionText={getPlainDescFromMd}
        label="Champions"
        suggestionLimit={10}
      />
      <AutocompleteArrayInput
        source="dependencies"
        allowDuplicates={false}
        translateChoice={false}
        choices={allNodes}
        optionValue="address"
        optionText={getPlainDescFromMd}
        label="Dependencies"
        suggestionLimit={10}
      />
      <AutocompleteArrayInput
        source="references"
        allowDuplicates={false}
        translateChoice={false}
        choices={allNodes}
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
            choices={userNodes}
            optionValue="address"
            optionText={getPlainDescFromMd}
            label="Contributors"
            suggestionLimit={10}
          />
        </SimpleFormIterator>
      </ArrayInput>
    </SimpleForm>
  );
};
