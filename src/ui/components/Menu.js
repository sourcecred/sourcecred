// @flow
import React from "react";
import {useSelector} from "react-redux";
import {MenuItemLink} from "react-admin";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import DefaultIcon from "@material-ui/icons/ViewList";
import TransformIcon from "@material-ui/icons/Transform";
import {type CurrencyDetails} from "../../api/currencyConfig";

type menuProps = {|onMenuClick: Function|};

const Menu = (hasBackend: Boolean, {name: currencyName}: CurrencyDetails) => ({
  onMenuClick,
}: menuProps) => {
  const open = useSelector((state) => state.admin.ui.sidebarOpen);
  return (
    <>
      <MenuItemLink
        to="/explorer"
        primaryText="Explorer"
        leftIcon={<TrendingUpIcon />}
        onClick={onMenuClick}
        sidebarIsOpen={open}
      />
      <MenuItemLink
        to="/accounts"
        primaryText={`${currencyName} Accounts`}
        leftIcon={<DefaultIcon />}
        onClick={onMenuClick}
        sidebarIsOpen={open}
      />
      {hasBackend && (
        <>
          <MenuItemLink
            to="/admin"
            primaryText="Ledger Admin"
            leftIcon={<DefaultIcon />}
            onClick={onMenuClick}
            sidebarIsOpen={open}
          />
          <MenuItemLink
            to="/transfer"
            primaryText={`Transfer ${currencyName}`}
            leftIcon={<TransformIcon />}
            onClick={onMenuClick}
            sidebarIsOpen={open}
          />
        </>
      )}
    </>
  );
};

export default Menu;
