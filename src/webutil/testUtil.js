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
