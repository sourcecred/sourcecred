// @flow
import React from "react";
import {createElement} from "react";
import {useSelector} from "react-redux";
import {MenuItemLink, getResources} from "react-admin";
import {type LoadSuccess} from "../load";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import DefaultIcon from "@material-ui/icons/ViewList";

type menuProps = {|onMenuClick: Function|};

const Menu = ({bundledPlugins}: LoadSuccess) => ({onMenuClick}: menuProps) => {
  const open = useSelector((state) => state.admin.ui.sidebarOpen);
  const resources = useSelector(getResources);
  return (
    <>
      <MenuItemLink
        to="/explorer"
        primaryText="explorer"
        leftIcon={<TrendingUpIcon />}
        onClick={onMenuClick}
        sidebarIsOpen={open}
      />

      {bundledPlugins.includes("sourcecred/initiatives") &&
        resources.map((resource) => {
          return (
            <MenuItemLink
              key={resource.name}
              to={`/${resource.name}`}
              primaryText={
                (resource.options && resource.options.label) || resource.name
              }
              leftIcon={
                resource.icon ? createElement(resource.icon) : <DefaultIcon />
              }
              onClick={onMenuClick}
              sidebarIsOpen={open}
            />
          );
        })}
    </>
  );
};

export default Menu;
