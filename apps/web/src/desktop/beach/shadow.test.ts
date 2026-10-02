import { describe, expect, it } from "vitest";
import { computeSky } from "../sky";
import { shade } from "./Shadow";

describe("shade", () => {
  it("đổi hướng theo mặt trời, đêm mờ hơn ngày", () => {
    expect(Math.abs(shade(computeSky(12)).k)).toBeLessThan(0.1);
    expect(shade(computeSky(8)).k).toBeGreaterThan(0.2);
    expect(shade(computeSky(16)).k).toBeLessThan(-0.2);
    expect(shade(computeSky(23)).op).toBeLessThan(shade(computeSky(12)).op);
  });
});
