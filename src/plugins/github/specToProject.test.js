// @flow

import {specToProject} from "./specToProject";
import {stringToRepoId} from "../../core/repoId";
import {type Project, createProject} from "../../core/project";
jest.mock("./fetchGithubOrg", () => ({fetchGithubOrg: jest.fn()}));
type JestMockFn = $Call<typeof jest.fn>;
const fetchGithubOrg: JestMockFn = (require("./fetchGithubOrg")
  .fetchGithubOrg: any);

describe("plugins/github/specToProject", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("works for a repoId", async () => {
    const spec = "foo/bar";
    const expected: Project = createProject({
      id: spec,
      repoIds: [stringToRepoId(spec)],
    });
    const actual = await specToProject(spec, "FAKE_TOKEN");
    expect(expected).toEqual(actual);
    expect(fetchGithubOrg).not.toHaveBeenCalled();
  });
  it("works for an owner", async () => {
    const repos = [stringToRepoId("foo/bar"), stringToRepoId("foo/zod")];
    const spec = "@foo";
    const token = "FAKE_TOKEN";
    const fakeOrg = {name: "foo", repos};
    fetchGithubOrg.mockResolvedValueOnce(fakeOrg);
    const actual = await specToProject(spec, token);
    expect(fetchGithubOrg).toHaveBeenCalledWith(fakeOrg.name, token);
    const expected: Project = createProject({
      id: spec,
      repoIds: repos,
    });
    expect(actual).toEqual(expected);
  });
  describe("fails for malformed spec strings", () => {
    const bad = [
      "foo",
      "foo_bar",
      "@@foo",
      " @foo ",
      "foo / bar",
      "",
      "@foo/bar",
    ];
    for (const b of bad) {
      it(`fails for "${b}"`, () => {
        expect.assertions(2);
        const fail = specToProject(b, "FAKE_TOKEN");
        return (
          expect(fail)
            .rejects.toThrow(`invalid spec: ${b}`)
            // The typedef says toThrow returns void, but this promise chain does
            // actually work. We don't need help from flow, since tests will fail
            // if the type is wrong.
            // $ExpectFlowError
            .then(() => {
              expect(fetchGithubOrg).toHaveBeenCalledTimes(0);
            })
        );
      });
    }
  });
});
