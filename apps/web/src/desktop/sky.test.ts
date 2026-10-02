import { describe, expect, it } from "vitest";
import { computeSky, SCENE } from "./sky";

describe("computeSky", () => {
  it("ban ngày: mặt trời trên đường chân trời, trời sáng, không sao", () => {
    const s = computeSky(12);
    expect(s.sun.y).toBeLessThan(SCENE.hor);
    expect(s.daylight).toBe(1);
    expect(s.starOp).toBe(0);
    expect(s.nightOp).toBe(0);
  });

  it("ban đêm: mặt trời dưới chân trời, trăng và sao hiện", () => {
    const s = computeSky(0);
    expect(s.sun.y).toBeGreaterThan(SCENE.hor);
    expect(s.moon.y).toBeLessThan(SCENE.hor);
    expect(s.daylight).toBe(0);
    expect(s.starOp).toBe(1);
    expect(s.nightOp).toBeGreaterThan(0.5);
  });

  it("mặt trời mọc ở bên trái lúc 6h và lặn ở bên phải lúc 18h", () => {
    const rise = computeSky(6);
    const set = computeSky(18);
    expect(rise.sun.x).toBeLessThan(SCENE.W / 2);
    expect(set.sun.x).toBeGreaterThan(SCENE.W / 2);
    expect(rise.sun.y).toBeCloseTo(SCENE.hor);
  });

  it("ánh sáng chân trời đậm lúc mọc/lặn, tắt giữa trưa và nửa đêm", () => {
    expect(computeSky(6).sunsetGlow).toBeGreaterThan(0.9);
    expect(computeSky(18).sunsetGlow).toBeGreaterThan(0.9);
    expect(computeSky(12).sunsetGlow).toBe(0);
    expect(computeSky(0).sunsetGlow).toBe(0);
  });

  it("giờ ngoài khoảng 0–24 được chuẩn hoá", () => {
    expect(computeSky(25).top).toBe(computeSky(1).top);
    expect(computeSky(-2).top).toBe(computeSky(22).top);
  });
});
