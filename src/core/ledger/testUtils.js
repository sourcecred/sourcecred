// @flow
import * as uuid from "../../util/uuid";

export interface UuidMock {
  resetFakeUuid(): void;
  setNextUuid(id: uuid.Uuid): void;
}

export function createUuidMock(): UuidMock {
  const randomMock = jest.spyOn(uuid, "random");

  let nextFakeUuidIndex = 0;

  function resetFakeUuid() {
    nextFakeUuidIndex = 0;
  }

  function setNextUuid(x: uuid.Uuid) {
    randomMock.mockImplementationOnce(() => x);
  }

  function nextFakeUuid(): uuid.Uuid {
    const uuidString = String(nextFakeUuidIndex).padStart(21, "0") + "A";
    nextFakeUuidIndex++;
    return uuid.fromString(uuidString);
  }

  randomMock.mockImplementation(nextFakeUuid);

  return {setNextUuid, resetFakeUuid};
}
