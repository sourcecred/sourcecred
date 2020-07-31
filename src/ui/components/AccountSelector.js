// @flow

import React, {useState} from "react";
import {Ledger, type Account} from "../../ledger/ledger";
import {useCombobox} from "downshift";

type DropdownProps = {|
  +ledger: Ledger,
  +setCurrentIdentity: (Account) => void,
|};

export default function AccountDropdown({
  setCurrentIdentity,
  ledger,
}: DropdownProps) {
  const items = ledger.accounts().filter((a) => a.active);
  const [inputItems, setInputItems] = useState<$ReadOnlyArray<Account>>(items);
  const [inputValue, setInputValue] = useState<string>("");
  const {
    isOpen,
    getToggleButtonProps,
    getMenuProps,
    getInputProps,
    getComboboxProps,
    highlightedIndex,
    getItemProps,
  } = useCombobox({
    inputValue,
    items: inputItems,
    onStateChange: ({inputValue, type, selectedItem}) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputChange:
          setInputValue(inputValue);
          setInputItems(
            items.filter((item) =>
              item.identity.name
                .toLowerCase()
                .startsWith(inputValue.toLowerCase())
            )
          );
          break;
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
        case useCombobox.stateChangeTypes.InputBlur:
          if (selectedItem) {
            setCurrentIdentity(selectedItem);
            setInputValue(selectedItem.identity.name);
          } else {
            setInputValue("");
          }

          break;
        default:
          break;
      }
    },
  });

  return (
    <div>
      <div style={comboboxStyles} {...getComboboxProps()}>
        <input {...getInputProps()} />
        <button
          type="button"
          {...getToggleButtonProps()}
          aria-label="toggle menu"
        >
          &#8595;
        </button>
      </div>
      <ul {...getMenuProps()} style={menuStyles(isOpen)}>
        {isOpen &&
          inputItems.map((item, index) => (
            <li
              style={
                highlightedIndex === index ? {backgroundColor: "#bde4ff"} : {}
              }
              key={`${item.identity.id}`}
              {...getItemProps({item, index})}
            >
              {item.identity.name}
            </li>
          ))}
      </ul>
    </div>
  );
}

export const menuStyles = (isOpen: boolean) => ({
  maxHeight: "180px",
  overflowY: "auto",
  width: "135px",
  margin: 0,
  border: isOpen ? "1px solid black" : 0,
  background: "white",
  position: "absolute",
  zIndex: 1000,
  listStyle: "none",
  padding: 0,
});

export const comboboxStyles = {display: "inline-block"};
