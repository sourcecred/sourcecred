//@flow

import {Container} from "@material-ui/core";
import React from "react"
import { SimpleForm, Edit, Create, NumberInput, TextInput } from "react-admin";


export const ConfigMgr = (props) => {
  return (<Container>
    <Edit {...props}>
      <SimpleForm>
        <NumberInput label="Max Simultanious Distributions" source="maxSimultaneousDistributions" />
      </SimpleForm>
    </Edit>
  </Container>);
}