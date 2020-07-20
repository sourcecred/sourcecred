// @flow
import React from "react";
import {createElement} from "react";
import {useSelector} from "react-redux";
import {useMediaQuery} from "@material-ui/core";
import {MenuItemLink, getResources} from "react-admin";
import {withRouter} from "react-router-dom";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import DefaultIcon from "@material-ui/icons/ViewList";

type menuProps = {|onMenuClick: Function, logout: Function|};

const Menu = ({onMenuClick, logout}: menuProps) => {
  const isXSmall = useMediaQuery((theme) => theme.breakpoints.down("xs"));
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

      {resources.map((resource) => {
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
      {isXSmall && logout}
    </>
  );
};

export default withRouter(Menu);
