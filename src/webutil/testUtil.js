// @flow

export function configureEnzyme() {
  const Enzyme = require("enzyme");
  const Adapter = require("enzyme-adapter-react-16");
  Enzyme.configure({adapter: new Adapter()});
  beforeEach(() => {
    // $FlowExpectedError
    console.error = jest.fn();
    // $FlowExpectedError
    console.warn = jest.fn();
  });
  afterEach(() => {
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
}

export function configureAphrodite() {
  const {StyleSheetTestUtils} = require("aphrodite/no-important");
  beforeEach(() => {
    StyleSheetTestUtils.suppressStyleInjection();
  });

  afterEach(() => {
    StyleSheetTestUtils.clearBufferAndResumeStyleInjection();
  });
}

export const relativeEntries = [
  {
    hash: "",
    pathname: "/foo/bar/",
    search: "",
    state: undefined,
  },
  {hash: "", pathname: "/1/", search: "", state: undefined},
  {hash: "", pathname: "/2/", search: "", state: undefined},
  {hash: "", pathname: "/3/", search: "", state: undefined},
  {hash: "", pathname: "/4/", search: "", state: undefined},
  {hash: "", pathname: "/5/", search: "", state: undefined},
];

export const memoryEntries = [
  {
    pathname: "/my/gateway/foo/bar/",
    search: "",
    hash: "",
    state: undefined,
  },
  {
    pathname: "/my/gateway/1/",
    search: "",
    hash: "",
    state: undefined,
  },
  {
    pathname: "/my/gateway/2/",
    search: "",
    hash: "",
    state: undefined,
  },
  {
    pathname: "/my/gateway/3/",
    search: "",
    hash: "",
    state: undefined,
  },
  {
    pathname: "/my/gateway/4/",
    search: "",
    hash: "",
    state: undefined,
  },
  {
    pathname: "/my/gateway/5/",
    search: "",
    hash: "",
    state: undefined,
  },
];
