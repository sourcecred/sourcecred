// @flow
import React, {type Node as ReactNode} from "react";
import {useSelector} from "react-redux";
import {MenuItemLink} from "react-admin";
import PeopleIcon from "@material-ui/icons/People";
import ExplorerIcon from "@material-ui/icons/Equalizer";
import AccountIcon from "@material-ui/icons/AccountBalanceWallet";
import HistoryIcon from "@material-ui/icons/History";
import TransferIcon from "@material-ui/icons/SwapCalls";
import {type CurrencyDetails} from "../../api/currencyConfig";

type menuProps = {|onMenuClick: Function|};

const createMenu = (
  hasBackend: boolean,
  {name: currencyName}: CurrencyDetails
): ((menuProps) => ReactNode) => {
  const Menu = ({onMenuClick}: menuProps) => {
    const open = useSelector((state) => state.admin.ui.sidebarOpen);
    return (
      <>
        <MenuItemLink
          to="/explorer-home"
          primaryText="Explorer"
          leftIcon={<ExplorerIcon />}
          onClick={onMenuClick}
          sidebarIsOpen={open}
        />
        <MenuItemLink
          to="/accounts"
          primaryText={`${currencyName} Accounts`}
          leftIcon={<AccountIcon />}
          onClick={onMenuClick}
          sidebarIsOpen={open}
        />
        <MenuItemLink
          to="/ledger"
          primaryText="Ledger History"
          leftIcon={<HistoryIcon />}
          onClick={onMenuClick}
          sidebarIsOpen={open}
        />
        {hasBackend && (
          <>
            <MenuItemLink
              to="/admin"
              primaryText="Identities"
              leftIcon={<PeopleIcon />}
              onClick={onMenuClick}
              sidebarIsOpen={open}
            />
            <MenuItemLink
              to="/transfer"
              primaryText={`Transfer ${currencyName}`}
              leftIcon={<TransferIcon />}
              onClick={onMenuClick}
              sidebarIsOpen={open}
            />
            <MenuItemLink
              to="/weight-config"
              primaryText="Configure Weights"
              leftIcon={<ExplorerIcon />}
              onClick={onMenuClick}
              sidebarIsOpen={open}
            />
          </>
        )}
      </>
    );
  };

  return Menu;
};

export default createMenu;
