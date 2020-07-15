// @flow
import React from "react";
import {v4 as uuid} from "uuid";
import {Create, SimpleForm} from "react-admin";
import {CredView} from "../../../analysis/credView";
import {AutocompleteArrayInput, TextInput} from "react-admin";
import {getPlainDescFromMd} from "../../uiUtils";

export const UserCreate = (credView: CredView) => (props: Object) => {
  const defaultUserValues = React.useMemo(
    () => ({
      id: uuid(),
      name: "",
      newAliases: [],
      aliases: [],
    }),
    []
  );
  const userNodes = React.useMemo(() => credView.userNodes(), [credView]);
  return (
    <Create title="Create New User" {...props}>
      <SimpleForm initialValues={defaultUserValues}>
        <TextInput source="id" label="Initiative ID" disabled />
        <TextInput source="name" label="Username" />
        <AutocompleteArrayInput
          source="newAliases"
          label="Aliases"
          allowDuplicates={false}
          translateChoice={false}
          choices={userNodes}
          optionValue="address"
          optionText={getPlainDescFromMd}
          suggestionLimit={10}
        />
      </SimpleForm>
    </Create>
  );
};
