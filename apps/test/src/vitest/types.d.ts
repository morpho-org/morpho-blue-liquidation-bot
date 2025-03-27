import "vitest";

declare global {
  namespace Chai {
    interface CloseTo {
      // biome-ignore lint/style/useShorthandFunctionType: Chai does it that way
      (expected: bigint, delta: bigint, message?: string): Assertion;
    }
  }
}
