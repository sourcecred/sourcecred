// @flow

import React from "react";
import {Admin, Resource, ListGuesser, EditGuesser} from "react-admin";
import fakeDataProvider from "ra-data-fakerest";
import {createMemoryHistory} from "history";

async function loadAndReport(path) {
  const response = await fetch(path);
  if (!response.ok) {
    console.error(path, response);
  }
  const json = await response.json();
  console.log(path, json);
}

const dataProvider = fakeDataProvider({
  people: [
    {id: 0, title: "Hello, world!"},
    {id: 1, title: "FooBar"},
    {id: 2, title: "Bar foo"},
  ],
  comments: [
    {id: 0, person_id: 0, author: "John Doe", body: "Sensational!"},
    {id: 1, person_id: 0, author: "Jane Doe", body: "I agree"},
  ],
});

const history = createMemoryHistory();

export default class App extends React.Component<{||}> {
  async componentDidMount() {
    loadAndReport("sourcecred.json");
    loadAndReport("output/credResult.json");
    loadAndReport("config/sourcecred/discourse/config.json");
  }

  render() {
    return (
      <Admin dataProvider={dataProvider} history={history}>
        <Resource name="people" list={ListGuesser} edit={EditGuesser} />
        <Resource name="comments" list={ListGuesser} edit={EditGuesser} />
      </Admin>
    );
  }
}
