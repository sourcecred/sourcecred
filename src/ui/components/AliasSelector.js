// @flow

import React, {useState, useMemo} from "react";
import {useCombobox, useMultipleSelection} from "downshift";
import {Ledger} from "../../ledger/ledger";
import {type Identity} from "../../ledger/identity";
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
  useMemo(() => {
    selectedItems.forEach((item) => {
      removeSelectedItem(item);
    });
    if (currentIdentity) {
      currentIdentity.aliases.forEach((aliasAddress) =>
        addSelectedItem(aliasAddress)
      );
    }
  }, [currentIdentity]);

  const getNodeDescription = (nodeAddress: NodeAddressT): string => {
    const node = credView.node(nodeAddress);
    if (node) {
      return node.description;
    }
    return "";
  };

  const claimedAddresses: Set<NodeAddressT> = new Set();
  for (const {identity} of ledger.accounts()) {
    claimedAddresses.add(identity.address);
    for (const address of identity.aliases) {
      claimedAddresses.add(address);
    }
  }

  const getFilteredItems = (items) =>
    items.filter(
      (item) =>
        !claimedAddresses.has(item) &&
        getNodeDescription(item)
          .toLowerCase()
          .startsWith(inputValue.toLowerCase())
    );

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
    items: getFilteredItems(credView.userNodes().map((i) => i.address)),
    onStateChange: ({inputValue, type, selectedItem}) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputChange:
          setInputValue(inputValue);
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
        {selectedItems.filter(getNodeDescription).map((selectedItem, index) => (
          <span
            key={`selected-item-${index}`}
            {...getSelectedItemProps({selectedItem, index})}
          >
            <Markdown
              renderers={{paragraph: "span"}}
              source={getNodeDescription(selectedItem)}
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
          getFilteredItems(credView.userNodes().map((i) => i.address)).map(
            (item, index) => (
              <li
                style={
                  highlightedIndex === index ? {backgroundColor: "#bde4ff"} : {}
                }
                key={`${item}${index}`}
                {...getItemProps({item, index})}
              >
                <Markdown
                  renderers={{paragraph: "span"}}
                  source={getNodeDescription(item)}
                />
              </li>
            )
          )}
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
  //right: "40px",
};
