// @flow

import React, {type Node as ReactNode, useMemo} from "react";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import {type Account} from "../../core/ledger/ledger";
import {type CurrencyDetails} from "../../api/currencyConfig";
import * as G from "../../core/ledger/grain";
import {useLedger} from "../utils/LedgerContext";
import {formatTimestamp} from "../utils/dateHelpers";
import {makeStyles} from "@material-ui/core/styles";
import IdentityDetails from "./LedgerViewer/IdentityDetails";
import {
  DEFAULT_SORT,
  SortOrders,
  useTableState,
} from "../../webutil/tableState";
import deepFreeze from "deep-freeze";
import TableSortLabel from "@material-ui/core/TableSortLabel";
import bigInt from "big-integer";
import {TableFooter, TablePagination} from "@material-ui/core";

type OverviewProps = {|+currency: CurrencyDetails|};

const useStyles = makeStyles(() => {
  return {
    container: {
      maxHeight: "80vh",
    },
  };
});

const PAGINATION_OPTIONS = deepFreeze([50, 100, 200]);

export const AccountOverview = ({
  currency: {
    name: currencyName,
    suffix: currencySuffix,
    decimals: decimalsToDisplay,
  },
}: OverviewProps): ReactNode => {
  const {ledger} = useLedger();
  const classes = useStyles();

  const lastDistributionTimestamp = ledger.lastDistributionTimestamp();
  const lastPayoutMessage = useMemo(
    () =>
      lastDistributionTimestamp === null
        ? ""
        : `Last distribution: ${formatTimestamp(lastDistributionTimestamp)}`,
    [lastDistributionTimestamp]
  );

  const accounts = useMemo(() => Array.from(ledger.accounts()), []);

  const ACTIVE_SORT = useMemo(
    () =>
      deepFreeze({
        name: Symbol("Active?"),
        fn: (n) => (n.active ? 5 : 0),
      }),
    []
  );

  const BALANCE_SORT = useMemo(
    () =>
      deepFreeze({
        name: Symbol("Current Balance"),
        fn: (n) => bigInt(n.balance),
      }),
    []
  );

  const EARNED_SORT = useMemo(
    () =>
      deepFreeze({
        name: Symbol(currencyName + " Earned"),
        fn: (n) => bigInt(n.paid),
      }),
    []
  );

  const sortingOptions = [ACTIVE_SORT, BALANCE_SORT, EARNED_SORT];

  const tsAccounts = useTableState(
    {data: accounts},
    {
      initialRowsPerPage: PAGINATION_OPTIONS[0],
      initialSort: {
        sortName: BALANCE_SORT.name,
        sortOrder: SortOrders.DESC,
        sortFn: BALANCE_SORT.fn,
      },
    }
  );

  const handleChangePage = (event, newIndex) => {
    tsAccounts.setPageIndex(newIndex);
  };

  const handleChangeRowsPerPage = (event) => {
    tsAccounts.setRowsPerPage(Number(event.target.value));
  };

  return (
    <>
      <TableContainer component={Paper} className={classes.container}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              {/*<TableCell align="right">Active?</TableCell>*/}

              {sortingOptions.map((value) => (
                <TableCell key={value.name.description} align="right">
                  <TableSortLabel
                    active={tsAccounts.sortName === value.name}
                    direction={
                      tsAccounts.sortName === value.name
                        ? tsAccounts.sortOrder
                        : DEFAULT_SORT
                    }
                    onClick={() => tsAccounts.setSortFn(value.name, value.fn)}
                  >
                    <b>{value.name.description}</b>
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {tsAccounts.currentPage.map((a) =>
              AccountRow(a, currencySuffix, decimalsToDisplay)
            )}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TablePagination
                rowsPerPageOptions={PAGINATION_OPTIONS}
                className={classes.paginator}
                colSpan={4}
                count={tsAccounts.length}
                rowsPerPage={tsAccounts.rowsPerPage}
                page={tsAccounts.pageIndex}
                SelectProps={{
                  inputProps: {"aria-label": "rows per page"},
                  native: true,
                }}
                onChangePage={handleChangePage}
                onChangeRowsPerPage={handleChangeRowsPerPage}
              />
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
      <p align="right">{lastPayoutMessage}</p>
    </>
  );
};

const AccountRow = (account: Account, suffix: string, decimals: number) => (
  <TableRow key={account.identity.id}>
    <TableCell component="th" scope="row">
      <IdentityDetails id={account.identity.id} name={account.identity.name} />
    </TableCell>
    <TableCell align="right">{account.active ? "✅" : "🛑"}</TableCell>
    <TableCell align="right">
      {G.format(account.balance, decimals, suffix)}
    </TableCell>
    <TableCell align="right">
      {G.format(account.paid, decimals, suffix)}
    </TableCell>
  </TableRow>
);
