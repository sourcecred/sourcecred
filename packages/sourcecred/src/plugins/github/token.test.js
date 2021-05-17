// @flow

import {validateToken} from "./token";

describe("plugins/github/token", () => {
  describe("validateToken", () => {
    function spyWarn(): JestMockFn<[string], void> {
      return ((console.warn: any): JestMockFn<any, void>);
    }
    beforeEach(() => {
      jest.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => {
      try {
        expect(console.warn).not.toHaveBeenCalled();
      } finally {
        spyWarn().mockRestore();
      }
    });

    it("should throw on empty tokens", () => {
      // Given
      const token = "";

      // When
      const fn = () => validateToken(token);

      // Then
      expect(fn).toThrow(
        "The token supplied to $SOURCECRED_GITHUB_TOKEN doesn't match any format known to work.\n" +
          'Please verify the token "" is correct, or report a bug if you think it should work.'
      );
    });

    it("should throw on an unknown format token", () => {
      // Given
      const token = "EXAMPLE-INVALID-TOKEN-1082369";

      // When
      const fn = () => validateToken(token);

      // Then
      expect(fn).toThrow(
        "The token supplied to $SOURCECRED_GITHUB_TOKEN doesn't match any format known to work.\n" +
          'Please verify the token "EXAMPLE-INVALID-TOKEN-1082369" is correct, or report a bug if you think it should work.'
      );
    });

    it("should accept a personal access token format", () => {
      // Given
      const token = "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";

      // When
      const validated = validateToken(token);

      // Then
      expect(token).toEqual(validated);
    });

    it("should accept an old personal access token format", () => {
      // Given
      const token = "1bfb713d900c4962586ec615260b3902438b1d3c";

      // When
      const validated = validateToken(token);

      // Then
      expect(token).toEqual(validated);
    });

    it("should accept an installation access token format", () => {
      // Given
      const token = "v1.1bfb713d900c49621bfb713d900c49621bfb713d";

      // When
      const validated = validateToken(token);

      // Then
      expect(token).toEqual(validated);
    });

    it("should warn when installation access token has an unexpected version", () => {
      // Given
      const token = "v5.1bfb713d900c49621bfb713d900c49621bfb713d";

      // When
      const validated = validateToken(token);

      // Then
      expect(console.warn).toHaveBeenCalledWith(
        'Warning: GitHub installation access token has an unexpected version "v5".'
      );
      expect(console.warn).toHaveBeenCalledTimes(1);
      spyWarn().mockReset();
      expect(token).toEqual(validated);
    });

    it("should warn when installation access token has an unexpected length", () => {
      // Given
      const token = "v1.1bfb713d900c49621bfb713d900c4962";

      // When
      const validated = validateToken(token);

      // Then
      expect(console.warn).toHaveBeenCalledWith(
        "Warning: GitHub installation access token has an unexpected hexadecimal component length of 32."
      );
      expect(console.warn).toHaveBeenCalledTimes(1);
      spyWarn().mockReset();
      expect(token).toEqual(validated);
    });
  });
});
