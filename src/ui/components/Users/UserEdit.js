// @flow
import React from "react";
import {
  ArrayField,
  AutocompleteArrayInput,
  Datagrid,
  Edit,
  SelectField,
  SimpleForm,
  TextInput,
} from "react-admin";
import {CredView} from "../../../analysis/credView";
import {getPlainDescFromMd} from "../../uiUtils";

export const UserEdit = (credView: CredView) => (props: Object) => {
  const userNodes = React.useMemo(() => credView.userNodes(), [credView]);
  return (
    <Edit title="Edit User" {...props}>
      <SimpleForm>
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
        <ArrayField source="aliases" label="">
          <Datagrid>
            <SelectField
              choices={userNodes}
              source="address"
              optionValue="address"
              optionText={getPlainDescFromMd}
              label="Synchronized Aliases"
            />
          </Datagrid>
        </ArrayField>
      </SimpleForm>
    </Edit>
  );
};
