// @flow

import React, {type Node as ReactNode, useMemo} from "react";
import {Container} from "@material-ui/core";
import {CredGrainView} from "../../../core/credGrainView";
import * as G from "../../../core/ledger/grain";
import CredTimeline from "../Explorer/CredTimeline";

type ProfileProps = {
  +credGrainView: CredGrainView | null,
};

export const ProfilePage = ({credGrainView}: ProfileProps): ReactNode => {
  if (!credGrainView)
    return (
      <div>
        <p>
          This page is unavailable because Cred information was unable to load.
          Calculate cred through the CLI in order to use this page.
        </p>
      </div>
    );
  const participantName = new URLSearchParams(location.search).get(
    "participant"
  );
  const participant = useMemo(() => {
    return credGrainView
      .participants()
      .find((participant) => participantName === participant.identity.name);
  }, [participantName]);
  if (!participant) {
    return (
      <div>
        <p>Participant [{participant}] was not found.</p>
      </div>
    );
  }
  return (
    <Container>
      ALL TIME CRED: {participant.cred}
      ALL TIME GRAIN: {G.format(participant.grainEarned)}
      CRED OVER TIME: <CredTimeline data={participant.credPerInterval} />
    </Container>
  );
};
