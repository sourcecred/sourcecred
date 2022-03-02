//@flow

import {Container} from "@material-ui/core";
import React, {type Node as ReactNode} from "react";
import {
  SimpleForm,
  Edit,
  ArrayInput,
  SimpleFormIterator,
  SelectInput,
  FormDataConsumer,
  required,
  AutocompleteArrayInput,
  SaveButton,
  Toolbar,
  TextInput,
  NumberInput,
  DateInput,
} from "react-admin";
import {OPERATORS} from "../../../core/credequate/operator";
const UserEditToolbar = (props) => (
  <Toolbar {...props}>
    <SaveButton />
  </Toolbar>
);

export const RawInstanceConfigEditor = (props: any): ReactNode => {
  return (
    <Container>
      <Edit title="Edit Plugins (sourcecred.json)" {...props}>
        <SimpleForm redirect={false} toolbar={<UserEditToolbar />}>
          <AutocompleteArrayInput
            source="bundledPlugins"
            label="CredRank Plugins"
            translateChoice={false}
            initialValue={[]}
            choices={[
              {id: "sourcecred/discord", name: "Discord"},
              {id: "sourcecred/github", name: "Github"},
              {id: "sourcecred/discourse", name: "Discourse"},
              {id: "sourcecred/initiatives", name: "Initiatives"},
            ]}
          />
          <ArrayInput
            source="credEquatePlugins"
            label="CredEquate Plugins"
            initialValue={[]}
          >
            <SimpleFormIterator>
              <SelectInput
                source="id"
                label="Plugin Name"
                choices={[
                  {id: "sourcecred/discord", name: "Discord"},
                  {id: "sourcecred/github", name: "Github"},
                ]}
              />
              <ArrayInput
                source="configsByTarget"
                label="Configs By Target"
                initialValue={[]}
              >
                <SimpleFormIterator>
                  <TextInput
                    source="target"
                    label="Target (server id, server url, repo url, etc.)"
                  />

                  <ArrayInput
                    source="configs"
                    label="Configs For Above Target"
                    initialValue={[]}
                  >
                    <SimpleFormIterator>
                      <TextInput
                        source="memo"
                        label="Memo (anything you want to write to identify or explain this config)"
                      />
                      <DateInput source="startDate" label="Start Date" />

                      <ArrayInput
                        source="operators"
                        label="Operators"
                        initialValue={[]}
                      >
                        <SimpleFormIterator>
                          <TextInput source="key" label="Key" />
                          <SelectInput
                            source="id"
                            label="Plugin Name"
                            choices={OPERATORS.map((operator) => ({
                              id: operator,
                              name: operator,
                            }))}
                          />
                        </SimpleFormIterator>
                      </ArrayInput>

                      <ArrayInput
                        source="weights"
                        label="Weights"
                        initialValue={[]}
                      >
                        <SimpleFormIterator>
                          <TextInput source="key" label="Key" />
                          <NumberInput source="default" label="Default" />
                          <ArrayInput
                            source="subkeys"
                            label="Subkeys"
                            initialValue={[]}
                          >
                            <SimpleFormIterator>
                              <TextInput source="subkey" label="Subkey" />
                              <TextInput source="memo" label="Memo" />
                              <NumberInput source="weight" label="weight" />
                            </SimpleFormIterator>
                          </ArrayInput>
                        </SimpleFormIterator>
                      </ArrayInput>

                      <ArrayInput
                        source="shares"
                        label="Shares"
                        initialValue={[]}
                      >
                        <SimpleFormIterator>
                          <TextInput source="key" label="Key" />
                          <NumberInput source="default" label="Default" />
                          <ArrayInput source="subkeys" label="Subkeys">
                            <SimpleFormIterator>
                              <TextInput source="subkey" label="Subkey" />
                              <TextInput source="memo" label="Memo" />
                              <NumberInput source="weight" label="weight" />
                            </SimpleFormIterator>
                          </ArrayInput>
                        </SimpleFormIterator>
                      </ArrayInput>
                    </SimpleFormIterator>
                  </ArrayInput>
                </SimpleFormIterator>
              </ArrayInput>
            </SimpleFormIterator>
          </ArrayInput>
        </SimpleForm>
      </Edit>
    </Container>
  );
};
