// @flow

import React, {useState} from "react";
import {type Identity} from "../../ledger/identity";
import {Ledger} from "../../ledger/ledger";
import {CredView} from "../../analysis/credView";
import {AliasSelector} from "./AliasSelector";

export type Props = {|
  +credView: CredView,
  +initialLedger: Ledger,
|};

export const LedgerAdmin = ({credView, initialLedger}: Props) => {
  const [ledger, setLedger] = useState<Ledger>(initialLedger);
  const [nextIdentityName, setIdentityName] = useState<string>("");
  const [currentIdentity, setCurrentIdentity] = useState<Identity | null>(null);
  const [promptString, setPromptString] = useState<string>("Add Identity:");
  const [checkboxSelected, setCheckBoxSelected] = useState<boolean>(false);

  function changeIdentityName(event: SyntheticInputEvent<HTMLInputElement>) {
    setIdentityName(event.currentTarget.value);
  }

  function createOrUpdateIdentity(
    event: SyntheticInputEvent<HTMLInputElement>
  ) {
    event.preventDefault();
    if (!currentIdentity) {
      const newID = ledger.createIdentity("USER", nextIdentityName);
      setActiveIdentity(ledger.account(newID).identity);
    } else {
      const {id} = currentIdentity;
      ledger.renameIdentity(id, nextIdentityName);
      setIdentityName("");
      setCurrentIdentity(null);
    }
    setLedger(ledger);
  }

  function toggleIdentityActivation({id}: Identity) {
    let nextLedger;
    if (ledger.account(id).active) {
      nextLedger = ledger.deactivate(id);
      setCheckBoxSelected(false);
    } else {
      nextLedger = ledger.activate(id);
      setCheckBoxSelected(true);
    }
    setLedger(nextLedger);
    setCurrentIdentity(nextLedger.account(id).identity);
  }

  function setActiveIdentity(identity: Identity) {
    const {name} = identity;
    if (currentIdentity && name === currentIdentity.name) {
      setIdentityName("");
      setCurrentIdentity(null);
      setCheckBoxSelected(false);
      setPromptString("Add Identity: ");
    } else {
      setIdentityName(name);
      setCurrentIdentity(identity);
      setCheckBoxSelected(ledger.account(identity.id).active);
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
      <h1>Identities</h1>
      {ledger.accounts().length > 0 && <h3>click one to update it</h3>}
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
        <input
          type="submit"
          value={currentIdentity ? "update username" : "create identity"}
        />
        <br />
        <input
          type="button"
          value="save ledger to disk"
          onClick={() => {
            fetch("http://localhost:6006/data/ledger.json", {
              headers: {
                Accept: "text/plain",
                "Content-Type": "text/plain",
              },
              method: "POST",
              body: ledger.serialize(),
            });
          }}
        />
        {currentIdentity && (
          <>
            <br />
            <input
              type="button"
              value="New identity"
              onClick={() => setActiveIdentity(currentIdentity)}
            />
            <br />
            <input
              type="checkbox"
              id="active"
              name="active"
              checked={checkboxSelected}
              onChange={() => toggleIdentityActivation(currentIdentity)}
            />
            <label htmlFor="active">Account is active</label>
          </>
        )}
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
