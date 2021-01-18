// @flow
import React, {type Node as ReactNode} from "react";
import {
  Menu,
  MenuItem,
  ListItem,
  ListItemText,
  List,
  Divider,
} from "@material-ui/core";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@material-ui/icons/KeyboardArrowUp";
import {makeStyles} from "@material-ui/core/styles";
import {CredView} from "../../../analysis/credView";
import {type NodeAddressT} from "../../../core/graph";
import {type PluginDeclaration} from "../../../analysis/pluginDeclaration";

const styles = makeStyles(() => ({
  menuHeader: {fontWeight: "bold"},
  divider: {backgroundColor: "#F20057", height: "2px"},
}));

export type FilterState = {|
  // Whether to filter down to a particular type prefix.
  // If unset, shows all user-typed nodes
  filter: NodeAddressT | null,
  anchorEl: HTMLElement | null,
  name: string | null,
|};

export const DEFAULT_FILTER: FilterState = {
  anchorEl: null,
  filter: null,
  name: "All users",
};

const FilterSelect = ({
  credView,
  filterState,
  setFilterState,
}: {
  credView: CredView,
  filterState: FilterState,
  setFilterState: (FilterState) => void,
}): ReactNode => {
  const plugins = credView.plugins();

  const handleMenuClose = () =>
    setFilterState({...filterState, anchorEl: null});

  const optionGroup = (declaration: PluginDeclaration) => {
    const header = (
      <MenuItem
        key={declaration.nodePrefix}
        value={declaration.nodePrefix}
        className={styles.menuHeader}
        onClick={() =>
          setFilterState({
            anchorEl: null,
            filter: declaration.nodePrefix,
            name: declaration.name,
          })
        }
      >
        {declaration.name}
      </MenuItem>
    );
    const entries = declaration.nodeTypes.map((type, index) => (
      <MenuItem
        key={index}
        value={type.prefix}
        onClick={() =>
          setFilterState({
            anchorEl: null,
            filter: type.prefix,
            name: type.name,
          })
        }
      >
        {"\u2003" + type.name}
      </MenuItem>
    ));
    return [header, ...entries];
  };
  return (
    <>
      <List component="div" aria-label="Device settings">
        <ListItem
          button
          aria-haspopup="true"
          aria-controls="filter-menu"
          aria-label="filters"
          onClick={(event) =>
            setFilterState({
              ...filterState,
              anchorEl: event.currentTarget,
            })
          }
        >
          <ListItemText
            primary={
              filterState.name ? `Filter: ${filterState.name}` : "Filter"
            }
          />
          {filterState.anchorEl ? (
            <KeyboardArrowUpIcon />
          ) : (
            <KeyboardArrowDownIcon />
          )}
        </ListItem>
        <Divider className={styles.divider} />
      </List>

      <Menu
        id="lock-menu"
        anchorEl={filterState.anchorEl}
        keepMounted
        open={Boolean(filterState.anchorEl)}
        onClose={handleMenuClose}
        getContentAnchorEl={null}
        anchorOrigin={{vertical: "bottom", horizontal: "left"}}
        transformOrigin={{vertical: "top", horizontal: "left"}}
      >
        <MenuItem
          key={"All users"}
          value={""}
          className={styles.menuHeader}
          onClick={() =>
            setFilterState({
              anchorEl: null,
              filter: null,
              name: "All users",
            })
          }
        >
          All users
        </MenuItem>
        {plugins.map(optionGroup)}
      </Menu>
    </>
  );
};

export default FilterSelect;
