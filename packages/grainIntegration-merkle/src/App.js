// @flow
import logo from "./logo.svg";
import "./App.css";
import { LoginButton } from "./LoginButton";
import { useWeb3 } from "./Web3Context";
import { Contract, BigNumber as BN } from "ethers";
import { makeStyles } from "@material-ui/core/styles";
import { soliditySha3 } from "web3-utils";
import { MerkleTree } from "merkletreejs";
import { formatAndTrim, formatTimestamp } from "./lib";
import {
  List,
  ListItem,
  ListItemText,
  Typography,
  Button,
  CircularProgress
} from "@material-ui/core";
import keccak256 from "keccak256";
import * as React from "react";
// Pipe this json in on load if it fails during integration testing
import redeemContract from "./artifacts/contracts/MerkleRedeem.sol/MerkleRedeem";

const useStyles = makeStyles(theme => {
  return {
    distributionList: {
      width: "80%"
    },
    distributionDate: {
      flexGrow: 3
    },
    distributionAmount: {
      [theme.breakpoints.up("sm")]: {
        textAlign: "right"
      }
    },
    unclaimedDistribution: {
      display: "block",
      [theme.breakpoints.up("sm")]: {
        display: "flex",
        justifyContent: "space-between",
        gap: "1rem"
      }
    },
    timelineCell: {}
  };
});

function App(): React.Node {
  const payoutDistributions = [
    [
      ["0xd51f6257338419e442288181e82d8E74276172Ab", "4720214602065400299520"],
      ["0x9476c4Ce2CbC45b90207c3c3eC06bef6E1C705a8", "279785397934599700480"]
    ],
    [
      ["0xd51f6257338419e442288181e82d8E74276172Ab", "4720214602065401872384"],
      ["0x9476c4Ce2CbC45b90207c3c3eC06bef6E1C705a8", "279785397934598127616"]
    ],
    []
  ];

  return (
    <div className="App">
      <header className="App-header">
        <LoginButton />
        <OpenClaimButton
          payoutDistributions={payoutDistributions}
          handleClickFn={() => {
            console.log("open claim view clicked");
          }}
        />
        <ClaimAmountList payoutDistributions={payoutDistributions} />
        {/*<ClaimAmountButton
          handleClickFn={() => {
            console.log("claim button clicked");
          }}
          payoutDistributions={payoutDistributions}
        /> */}

        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
      </header>
    </div>
  );
}

export default App;

type ClaimAmountListProps = {|
  +payoutDistributions: Array<Array<[string, string]>>
|};

export function ClaimAmountList({
  payoutDistributions
}: ClaimAmountListProps): React.Node {
  const { address, isConnected, provider } = useWeb3();
  const [payouts, setPayouts] = React.useState<any>([]);
  const [currentNetworkId, setCurrentNetworkId] = React.useState<?number>();

  const classes = useStyles();
  const getNextPayouts = async () => {
    let nextPayouts = payouts;
    console.log("recalculating");
    if (isConnected && address && provider) {
      const currentNetwork = await provider.getNetwork();

      console.log(
        "chainId",
        currentNetwork.chainId,
        currentNetwork.chainId !== 1337
      );
      setCurrentNetworkId(currentNetwork.chainId);
      if (currentNetwork.chainId !== 1337) return <> Wrong Network </>;
      const contract = new Contract(
        "0x52b5b6a06c975107c8ac19b6b116cc8f72e17578",
        redeemContract.abi,
        provider.getSigner()
      );
      nextPayouts = await findUnclaimedPayouts(
        payoutDistributions,
        address,
        contract
      );
      setPayouts(nextPayouts);
    } else {
      setPayouts([]);
    }
  };

  console.log({ address, isConnected, currentNetworkId });
  React.useEffect(
    () => {
      getNextPayouts();
    },
    [address, isConnected, currentNetworkId]
  );

  console.log({ address, isConnected, payouts });

  if (currentNetworkId && currentNetworkId !== 1337)
    return <> Wrong Network </>;
  return payouts.length ? (
    <List className={classes.distributionList}>
      {payouts.map((distro, idx) => (
        <ListItem className={classes.unclaimedDistribution} key={idx}>
          <ListItemText
            className={classes.distributionDate}
            primary={
              "Distribution on " + formatTimestamp(distro.timestamp * 1000)
            }
          />
          <ListItemText
            className={classes.distributionAmount}
            primary={formatAndTrim(distro.payout[1], 2)}
          />
        </ListItem>
      ))}
    </List>
  ) : (
    <>"No Payouts To Claim"</>
  );
}

type ClaimAmountProps = {|
  +handleClickFn: (...any) => any,
  +payoutDistributions: Array<Array<[string, string]>>
|};

export function OpenClaimButton({
  handleClickFn,
  payoutDistributions
}: ClaimAmountProps): React.Node {
  const { address, isConnected, provider } = useWeb3();
  const [payouts, setPayouts] = React.useState<Array<[string, string] | null>>(
    []
  );
  const [payoutSum, setPayoutSum] = React.useState<string | null>(null);

  React.useMemo(
    () => {
      if (isConnected && address != null) {
        const nextPayouts = findPayouts(payoutDistributions, address);
        const nextPayoutSum = sumPayouts(payoutDistributions, address);

        setPayoutSum(nextPayoutSum);
        setPayouts(nextPayouts);
        console.log({ nextPayouts, provider });
      }
    },
    [isConnected, payoutDistributions]
  );

  return (
    <Button onClick={handleClickFn}>
      {isConnected && address && payoutSum
        ? formatAndTrim(payoutSum, 2)
        : "no payouts"}
    </Button>
  );
}

export function ClaimAmountButton({
  handleClickFn,
  payoutDistributions
}: ClaimAmountProps): React.Node {
  const { address, isConnected, provider } = useWeb3();
  const [payouts, setPayouts] = React.useState<Array<[string, string] | null>>(
    []
  );
  const [payoutSum, setPayoutSum] = React.useState<string | null>(null);

  console.log("claim button mounted");
  React.useMemo(
    () => {
      if (isConnected && address != null) {
        const nextPayouts = findPayouts(payoutDistributions, address);
        const nextPayoutSum = sumPayouts(payoutDistributions, address);

        setPayoutSum(nextPayoutSum);
        setPayouts(nextPayouts);
        console.log({ nextPayouts });
      }
    },
    [isConnected, payoutDistributions]
  );

  const claimDistributions = React.useCallback(async () => {
    if (!isConnected || !provider) return;
    const contract = new Contract(
      "0x52b5b6a06c975107c8ac19b6b116cc8f72e17578",
      redeemContract.abi,
      provider.getSigner()
    );

    getDistributionDetails(contract);
    const unclaimedPayouts = await findUnclaimedPayouts(
      payoutDistributions,
      address,
      contract
    );
    console.log({ unclaimedPayouts });
    const distributionHeight = await getLastDistributionId(contract);
    const hashedElements = payoutDistributions.map(distro =>
      distro.map(([address, amount]) => soliditySha3(address, amount))
    );
    console.log({
      distributionHeight: distributionHeight.toString(),
      hashedElements
    });
    console.log({ payouts });
    const roots = await contract.merkleRoots(0, 7);
    console.log({ roots, hashedElements });
    payouts.forEach(async (payout, payoutWeek) => {
      if (payout == null) return;
      const [contributor, balance] = payout;
      const tree = createMerkleTree(hashedElements[payoutWeek]);
      const root = tree.getHexRoot();
      const proof = tree.getHexProof(soliditySha3(contributor, balance));
      console.log({ tree, root, proof, contributor, balance, payoutWeek });
      const result = await contract.verifyClaim(
        contributor,
        payoutWeek,
        balance,
        proof
      );
      console.log(`${payoutWeek} result: `, result);
    });
  });

  claimDistributions();
  return (
    <Button onClick={handleClickFn}>
      {isConnected && address ? payoutSum : "no payouts"}
    </Button>
  );
}

const findPayouts = (
  payoutDistributions: Array<Array<[string, string]>>,
  userAddress: string
): Array<[string, string] | null> => {
  return payoutDistributions.map((distro: Array<[string, string]>) => {
    const element = distro.find(
      ([address, amount]) => address.toLowerCase() === userAddress.toLowerCase()
    );
    if (!element) return null;
    return element;
  });
};

async function findUnclaimedPayouts(
  payoutDistributions,
  userAddress: ?string,
  contract
) {
  if (!userAddress) return [];
  const payouts = findPayouts(payoutDistributions, userAddress);
  const claimStatuses = await getClaimStatus(contract, userAddress);
  const distributionDetails = await getDistributionDetails(contract);
  // need to assert the status is false, because undefined could mean a payout
  // isn't onchain or something else weird
  return payouts
    .filter(payout => payout)
    .map((payout, index) => ({ ...distributionDetails[index], payout }))
    .filter((payout, index) => claimStatuses[index] === false);
}

const sumPayouts = (
  payoutDistributions: Array<Array<[string, string]>>,
  userAddress: string
): string => {
  return findPayouts(payoutDistributions, userAddress)
    .map((element: [string, string] | null) => {
      if (!element) return BN.from(0);
      const [_, amountString] = element;

      return BN.from(amountString);
    })
    .reduce((acc, val) => acc.add(val))
    .toString();
};

async function getDistributionDetails(contract: any): Promise<Array<any>> {
  const publishFilter = contract.filters.DistributionPublished();
  const publishEvents = await contract.queryFilter(publishFilter);
  const eventsWithBlockData = await Promise.all(
    publishEvents.map(async e => {
      const { timestamp } = await e.getBlock();
      return {
        distributionEventArgs: e.args,
        timestamp
      };
    })
  );
  console.log({ eventsWithBlockData });
  return eventsWithBlockData;
}
async function getLastDistributionId(contract /*: any*/) {
  const publishFilter = contract.filters.DistributionPublished();
  const publishEvents = await contract.queryFilter(publishFilter);
  const lastPublishedId = publishEvents.pop();
  return lastPublishedId ? lastPublishedId.args._id : 0;
}

async function getClaimStatus(
  contract: any,
  contributor: string
): Promise<Array<boolean>> {
  const length = await getLastDistributionId(contract);
  return await contract.claimStatus(contributor, 0, length);
}

function createMerkleTree(elements) {
  return new MerkleTree(elements, keccak256, {
    hashLeaves: false,
    sortPairs: true
  });
}

// TODOs
// - Get the components building properly and run them in the frontend
// - load merkle tree outputs in the frontend using code written here
// - pipe merkle distribution csvs (or jsons) as output - done
// - use the csvs to find amounts to be claimed and check claim statuses - done
// - use those csvs to compose the trees in the browser and create proofs - done
