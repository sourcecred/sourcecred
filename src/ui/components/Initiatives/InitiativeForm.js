// @flow
import {dateFormatter, dateParser, getPlainDescFromMd} from "../../uiUtils";
import {CredView} from "../../../analysis/credView";
import React from "react";
import {
  ArrayInput,
  AutocompleteArrayInput,
  BooleanInput,
  DateInput,
  NumberInput,
  SimpleFormIterator,
  TextInput,
} from "react-admin";
import {InlineKeyField} from "./InlineKeyField";

type InitiativeFormProps = {|
  credView: CredView,
|};
export const InitiativeForm = ({credView}: InitiativeFormProps) => {
  const allNodes = React.useMemo(() => credView.nodes(), [credView]);
  const userNodes = React.useMemo(() => credView.userNodes(), [credView]);
  return (
    <>
      <TextInput source="id" label="Initiative ID" disabled />
      <br />
      <TextInput label="Title" source="title" />
      <br />
      <DateInput
        format={dateFormatter}
        parse={dateParser}
        label="Date"
        source="timestampMs"
      />
      <br />
      <NumberInput label="Weight While Incomplete" source="weight.incomplete" />
      <br />
      <NumberInput label="Weight When Completed" source="weight.complete" />
      <br />
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
          <InlineKeyField source="key" label="Contribution Key" />
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
    </>
  );
};
