// @flow

import React, {useState} from "react";
import {type Identity} from "../../ledger/identity";
import {Ledger} from "../../ledger/ledger";
import {CredView} from "../../analysis/credView";
import {AliasSelector} from "./AliasSelector";

export type Props = {|
  +credView: CredView,
|};

export const LedgerAdmin = ({credView}: Props) => {
  const [ledger, setLedger] = useState<Ledger>(new Ledger());
  const [nextIdentityName, setIdentityName] = useState<string>("");
  const [currentIdentity, setCurrentIdentity] = useState<Identity | null>(null);
  const [promptString, setPromptString] = useState<string>("Add Identity:");

  // TODO: fix any
  function changeIdentityName(event: any) {
    setIdentityName(event.target.value);
  }

  function createOrUpdateIdentity(event: any) {
    event.preventDefault();
    if (!currentIdentity) {
      const newID = ledger.createIdentity("USER", nextIdentityName);
      setLedger(ledger);
      setIdentityName("");
      setActiveIdentity(ledger.account(newID).identity);
    } else {
      const {id} = currentIdentity;
      ledger.renameIdentity(id, nextIdentityName);
      setLedger(ledger);
      setIdentityName("");
      setCurrentIdentity(null);
    }
  }

  function setActiveIdentity(identity: Identity) {
    const {name} = identity;
    if (currentIdentity && name === currentIdentity.name) {
      setIdentityName("");
      setCurrentIdentity(null);
      setPromptString("Add Identity: ");
    } else {
      setIdentityName(name);
      setCurrentIdentity(identity);
      setPromptString("Update Identity: ");
    }
  }
  return (
    <div
      style={{
        width: "80%",
        margin: "0 auto",
        background: "white",
        padding: "0 5em 5em",
      }}
    >
      <h1>Identities:</h1>
      <ul>{renderIdentities()}</ul>
      <h1>{promptString}</h1>
      <form onSubmit={(e) => createOrUpdateIdentity(e)}>
        <p>
          <label htmlFor="Name">Name</label> <br />
          <input
            type="text"
            name="Name"
            value={nextIdentityName}
            onChange={(e) => changeIdentityName(e)}
          />
        </p>
        <input type="submit" value="Submit" />
      </form>
      <div>
        {/* Warning: don't conditionally render AliasSelector because it contains react hooks*/}
        <AliasSelector
          currentIdentity={currentIdentity}
          ledger={ledger}
          setLedger={setLedger}
          setCurrentIdentity={setCurrentIdentity}
          credView={credView}
        />
      </div>
    </div>
  );

  function renderIdentities() {
    function renderIdentity(i: Identity) {
      return (
        <li onClick={() => setActiveIdentity(i)} key={i.id}>
          {i.name}
        </li>
      );
    }
    return (
      <div>
        {ledger
          .accounts()
          .map((a) => a.identity)
          .map(renderIdentity)}
      </div>
    );
  }
};
