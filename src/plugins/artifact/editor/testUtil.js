import {StyleSheetTestUtils} from "aphrodite/no-important";

export function configureAphrodite() {
  beforeEach(() => {
    StyleSheetTestUtils.suppressStyleInjection();
  });

  afterEach(() => {
    StyleSheetTestUtils.clearBufferAndResumeStyleInjection();
  });
}
