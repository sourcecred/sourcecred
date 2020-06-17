// @flow
import React from "react";
import {users, activities, project} from "../graph";
import {v4 as uuid} from "uuid";
import {
  AutocompleteArrayInput,
  List,
  Datagrid,
  DateField,
  DateInput,
  ArrayField,
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
  regex,
  Loading,
} from "react-admin";

export const InitiativeList = (scData) => (props: Object) => {
  if (!scData.loaded) return <Loading />;

  return (
    <List {...props}>
      <Datagrid rowClick="edit">
        <TextField label="Initiative Name" source="title" />
        <BooleanField label="Completed" source="completed" />
        <DateField label="Last Updated" source="timestampIso" />
      </Datagrid>
    </List>
  );
};

export const InitiativeEdit = (scData) => (props: Object) => {
  console.log("derp: ", scData);
  if (!scData.loaded) return <Loading />;
  const initiatives = scData.activities.filter((a) =>
    /\u0000sourcecred\u0000initiatives\u0000initiative\u0000/.test(a.address)
  );
  console.log("init: ", initiatives);
  return (
    <Edit title={`Edit Initiative: ${props.id}`} {...props}>
      <SimpleForm>
        <TextInput label="Title" source="title" />
        <DateInput label="Date" source="timestampIso" />
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
          optionText="description"
          label="Champions"
          suggestionLimit={10}
        />
        <AutocompleteArrayInput
          source="dependencies"
          allowDuplicates={false}
          translateChoice={false}
          choices={initiatives}
          parse={(v) => {
            //v = {entries: v};
            return v;
          }}
          optionValue="address"
          optionText="description"
          label="Dependencies"
          suggestionLimit={10}
        />
        <AutocompleteArrayInput
          source="references"
          allowDuplicates={false}
          translateChoice={false}
          choices={scData.activities}
          parse={(v) => {
            //v = {entries: v};

            return v;
          }}
          optionValue="address"
          optionText="description"
          label="References"
          suggestionLimit={10}
        />
        {/**/}
        <ArrayInput label="Contributions" source="contributions">
          <SimpleFormIterator>
            <TextInput label="Contribution Name" source="title" />
            <DateInput label="Date" source="timestampIso" />
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
              optionText="description"
              label="Contributors"
              suggestionLimit={10}
            />
          </SimpleFormIterator>
        </ArrayInput>
      </SimpleForm>
    </Edit>
  );
};

export const InitiativeCreate = (scData) => (props: Object) => {
  if (!scData.loaded) return <Loading />;
  const defaultValues = {
    id: uuid(),
    timestampMs: new Date(),
    champions: [],
    dependencies: [],
    references: [],
    contributions: [],
    weight: {incomplete: 0, complete: 0},
  };
  const initiatives = scData.activities.filter((a) =>
    /\u0000sourcecred\u0000initiatives\u0000initiative\u0000/.test(a.address)
  );
  return (
    <Create title="Create New Initiative" {...props}>
      <SimpleForm initialValues={defaultValues}>
        <TextInput source="id" label="Unique ID (Don't touch)" disabled />
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
          optionText="description"
          label="Champions"
          suggestionLimit={10}
        />
        <AutocompleteArrayInput
          source="dependencies"
          allowDuplicates={false}
          translateChoice={false}
          choices={initiatives}
          parse={(v) => {
            //v = {entries: v};
            return v;
          }}
          optionValue="address"
          optionText="description"
          label="Dependencies"
          suggestionLimit={10}
        />
        <AutocompleteArrayInput
          source="references"
          allowDuplicates={false}
          translateChoice={false}
          choices={scData.activities}
          parse={(v) => {
            //v = {entries: v};

            return v;
          }}
          optionValue="address"
          optionText="description"
          label="References"
          suggestionLimit={10}
        />
        {/**/}
        <ArrayInput label="Contributions" source="contributions">
          <SimpleFormIterator>
            <TextInput label="Contribution Name" source="title" />
            <DateInput label="Date" source="timestampIso" />
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
              optionText="description"
              label="Contributors"
              suggestionLimit={10}
            />
          </SimpleFormIterator>
        </ArrayInput>
      </SimpleForm>
    </Create>
  );
};

// hacky temporary solution to implementing the url resolver in the frontend
const userTextFinder = (scData) => (v) => {
  if (!v) v = [];
  const resolvedV = [...v];

  v.forEach((c, idx) => {
    if (/^http/.test(c)) {
      const splitUrl = c.split("/");
      const resolvedUser = scData.users.find((u) => u.description.includes(c));
      if (resolvedUser) {
        resolvedV[idx] = resolvedUser.address;
        return;
      }
      const {identities} = scData.project[1];
      const resolvedIdentity = identities.find(({username, aliases}) =>
        aliases.find((a) => a.includes(splitUrl[splitUrl.length - 1]))
      );
      if (resolvedIdentity) {
        const resolvedUser = scData.users.find((u) =>
          u.description.includes(resolvedIdentity.username)
        );
        resolvedV[idx] = resolvedUser.address;
        return;
      }

      const fuzzyResolvedUser = scData.users.find((u) =>
        u.description.includes(splitUrl[splitUrl.length - 1])
      );

      if (fuzzyResolvedUser) {
        resolvedV[idx] = fuzzyResolvedUser.address;
        return;
      }
    }
  });
  return resolvedV;
};

const initiativeFinder = (initiatives) => (v) => {
  if (!v) v = {};
  if (!v.urls) v.urls = [];
  if (!v.entries) v.entries = [];
  v.urls.forEach((url) => {
    const shapedUrl = initiatives.find((i) => i.address.includes(url));
    if (shapedUrl) v.entries.push(shapedUrl);
  });
  return v.entries;
};

const activityFinder = (scData) => (v) => {
  if (!v) v = {};
  if (!v.urls) v.urls = [];
  if (!v.entries) v.entries = [];
  v.urls.forEach((url) => {
    const shapedUrl = scData.activities.find((i) => i.address.includes(url));
    if (shapedUrl) v.entries.push(shapedUrl);
  });
  return v.entries;
};
