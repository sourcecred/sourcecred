// @flow
import React from "react";
import {v4 as uuid} from "uuid";
import TextField from "@material-ui/core/TextField";
import {useInput} from "react-admin";

type Props = {|
  source: string,
  label: string,
|};

export const InlineKeyField = (props: Props) => {
  const key = React.useMemo(() => uuid(), []);

  const {
    id,
    input,
    meta: {touched, error},
    isRequired,
  } = useInput({
    ...props,
    initialValue: key,
  });

  return (
    <TextField
      id={id}
      {...input}
      label={props.label}
      error={!!(touched && error)}
      helperText={touched && error}
      required={isRequired}
      disabled
    />
  );
};
