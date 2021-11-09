/* eslint-disable react/jsx-key */
//@flow

import {Container} from "@material-ui/core";
import React from "react"
import { SimpleForm, Edit,
  ArrayInput, SimpleFormIterator, SelectInput, 
  FormDataConsumer, required } from "react-admin";

export const TestForm = (props) => (
  <Container>
    <Edit {...props} >
      <SimpleForm redirect={false}>
        <ArrayInput source="fruit" label="Fruit">
          <SimpleFormIterator>
            <SelectInput source="fruitType" label="FruitType" choices={[
              { id: 'apple', name: 'Apple' },
              { id: 'banana', name: 'Banana' },
              { id: 'cherry', name: 'Cherry' }
            ]} />
            <FormDataConsumer>  
                {({ scopedFormData, getSource }) => {
                  if(!scopedFormData){
                    return null
                  }
                  //const newRecord = {fruitType: scopedFormData.fruitType}
                  /*for (const key in scopedFormData) {
                    if (key !== "fruitType") {
                      delete scopedFormData[key];
                    } 
                  }*/
                  console.log("SFD:")
                  console.log(scopedFormData)          
                  switch(scopedFormData.fruitType) {
                    case "apple":
                      return [<SelectInput source={getSource("appleType")} validate={required()} label="Apple Type" record={scopedFormData} choices={[
                        { id: 'granny smith', name: 'Granny Smith' },
                        { id: 'fuji', name: 'Fuji' }
                      ]} />]
                    case "banana":
                      return [<SelectInput source={getSource("color")} record={scopedFormData} label="Color" choices={[
                        { id: 'green', name: 'Green' },
                        { id: 'yellow', name: 'Yellow' }
                      ]} />]
                    case "cherry":
                      return (
                      [<SelectInput source={getSource("color")} record={scopedFormData} label="Color" choices={[
                        { id: 'red', name: 'Red' },
                        { id: 'yellow', name: 'Yellow' }
                      ]} />,
                      <SelectInput source={getSource("cherryType")} record={scopedFormData} label="Cherry Type" choices={[
                        { id: 'raineer', name: 'Raineer' },
                        { id: 'bing', name: 'Bing' }
                      ]} />]
                      );
                }}}
            </FormDataConsumer>
          </SimpleFormIterator>
        </ArrayInput>
      </SimpleForm>
    </Edit>
  </Container>
)