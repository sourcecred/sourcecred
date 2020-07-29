// @flow

import React, {useState, useMemo} from "react";
import {useCombobox, useMultipleSelection} from "downshift";
import {Ledger} from "../../ledger/ledger";
import {type Identity, type Alias} from "../../ledger/identity";
import {CredView} from "../../analysis/credView";
import {type NodeAddressT} from "../../core/graph";
import Markdown from "react-markdown";

type Props = {|
  +currentIdentity: Identity | null,
  +ledger: Ledger,
  +credView: CredView,
  +setLedger: (Ledger) => void,
  +setCurrentIdentity: (Identity) => void,
|};

export function AliasSelector({
  currentIdentity,
  ledger,
  setLedger,
  setCurrentIdentity,
  credView,
}: Props) {
  const [inputValue, setInputValue] = useState("");
  const {
    getSelectedItemProps,
    getDropdownProps,
    addSelectedItem,
    removeSelectedItem,
    selectedItems,
  } = useMultipleSelection({
    initialSelectedItems: [],
  });

  // this memo is utilized to repopulate the selected Items
  // list each time the user is changed in the interface
  useMemo(() => {
    selectedItems.forEach((alias: Alias) => {
      removeSelectedItem(alias);
    });
    if (currentIdentity) {
      currentIdentity.aliases.forEach((alias) => addSelectedItem(alias));
    }
  }, [currentIdentity && currentIdentity.id]);

  const claimedAddresses: Set<NodeAddressT> = new Set();
  for (const {identity} of ledger.accounts()) {
    claimedAddresses.add(identity.address);
    for (const {address} of identity.aliases) {
      claimedAddresses.add(address);
    }
  }

  const potentialAliases = credView
    .userNodes()
    .map(({address, description}) => ({
      address,
      description,
    }))
    .filter(({address}) => !claimedAddresses.has(address));

  function filteredAliasesMatchingString(input: string): Alias[] {
    return potentialAliases.filter(({description}) =>
      description.toLowerCase().startsWith(input.toLowerCase())
    );
  }

  const [inputItems, setInputItems] = useState(
    filteredAliasesMatchingString("")
  );

  const setAliasSearch = (input: string = "") => {
    setInputItems(filteredAliasesMatchingString(input));
  };

  useMemo(() => {
    setAliasSearch();
  }, [currentIdentity && currentIdentity.aliases]);

  const {
    isOpen,
    getToggleButtonProps,
    getMenuProps,
    getInputProps,
    getComboboxProps,
    highlightedIndex,
    getItemProps,
    selectItem,
  } = useCombobox({
    inputValue,
    items: inputItems,
    onStateChange: ({inputValue, type, selectedItem}) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputChange:
          setInputValue(inputValue);
          setAliasSearch(inputValue);
          break;
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
        case useCombobox.stateChangeTypes.InputBlur:
          if (selectedItem && currentIdentity) {
            setLedger(ledger.addAlias(currentIdentity.id, selectedItem));
            setCurrentIdentity(ledger.account(currentIdentity.id).identity);
            setInputValue("");
            addSelectedItem(selectedItem);
            selectItem(null);
            claimedAddresses.add(selectedItem.address);
          }

          break;
        default:
          break;
      }
    },
  });
  return (
    <div style={{visibility: currentIdentity ? "visible" : "hidden"}}>
      <label>
        <h2>Aliases:</h2>
      </label>
      <div>
        {selectedItems.map((selectedItem, index) => (
          <span
            key={`selected-item-${index}`}
            {...getSelectedItemProps({selectedItem, index})}
          >
            <Markdown
              renderers={{paragraph: "span"}}
              source={selectedItem.description}
            />
            <br />
          </span>
        ))}
        <div style={comboboxStyles} {...getComboboxProps()}>
          <input
            {...getInputProps(getDropdownProps({preventKeyAction: isOpen}))}
          />
          <button {...getToggleButtonProps()} aria-label={"toggle menu"}>
            &#8595;
          </button>
        </div>
      </div>
      <ul {...getMenuProps()} style={menuMultipleStyles}>
        {isOpen &&
          inputItems.map((item, index) => (
            <li
              style={
                highlightedIndex === index ? {backgroundColor: "#bde4ff"} : {}
              }
              key={`${item.address}${index}`}
              {...getItemProps({item, index})}
            >
              <Markdown
                renderers={{paragraph: "span"}}
                source={item.description}
              />
            </li>
          ))}
      </ul>
    </div>
  );
}

const comboboxStyles = {display: "inline-block", marginLeft: "5px"};

const menuMultipleStyles = {
  maxHeight: "180px",
  overflowY: "auto",
  width: "135px",
  margin: 0,
  borderTop: 0,
  background: "white",
  position: "absolute",
  zIndex: 1000,
  listStyle: "none",
  padding: 0,
};
