// @flow
import React from "react";
import {useSelector} from "react-redux";
import {MenuItemLink} from "react-admin";
import {type LoadSuccess} from "../load";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import DefaultIcon from "@material-ui/icons/ViewList";
import TransformIcon from "@material-ui/icons/Transform";

type menuProps = {|onMenuClick: Function|};

const Menu = ({bundledPlugins}: LoadSuccess) => ({onMenuClick}: menuProps) => {
  const open = useSelector((state) => state.admin.ui.sidebarOpen);
  return (
    <>
      <MenuItemLink
        to="/explorer"
        primaryText="explorer"
        leftIcon={<TrendingUpIcon />}
        onClick={onMenuClick}
        sidebarIsOpen={open}
      />
      <MenuItemLink
        to="/grain"
        primaryText="Grain Accounts"
        leftIcon={<DefaultIcon />}
        onClick={onMenuClick}
        sidebarIsOpen={open}
      />
      <MenuItemLink
        to="/admin"
        primaryText="Ledger Admin"
        leftIcon={<DefaultIcon />}
        onClick={onMenuClick}
        sidebarIsOpen={open}
      />
      <MenuItemLink
        to="/transfer"
        primaryText="Transfer Grain"
        leftIcon={<TransformIcon />}
        onClick={onMenuClick}
        sidebarIsOpen={open}
      />
    </>
  );
};

export default Menu;
