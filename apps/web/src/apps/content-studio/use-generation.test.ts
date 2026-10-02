import { describe, expect, it } from "vitest";
import { generationReducer, initialGeneration, type GenerationState } from "./use-generation";

const v = (n: number) => ({ title: `T${n}`, body: `B${n}`, hashtags: [], cta: "" });
const run = (...actions: Parameters<typeof generationReducer>[1][]): GenerationState => actions.reduce(generationReducer, initialGeneration);

describe("generationReducer", () => {
  it("start tạo 3 thẻ trống và đang stream", () => {
    const s = run({ type: "start" });
    expect(s.status).toBe("streaming");
    expect(s.variants).toHaveLength(3);
    expect(s.variants.every((x) => !x.done)).toBe(true);
  });

  it("delta cộng dồn vào đúng thẻ, variant đánh dấu hoàn tất", () => {
    const s = run(
      { type: "start" },
      { type: "event", event: { type: "delta", index: 1, variant: { title: "Hi" } } },
      { type: "event", event: { type: "delta", index: 1, variant: { body: "Hello" } } },
      { type: "event", event: { type: "variant", index: 0, variant: v(0) } },
    );
    expect(s.variants[1]).toEqual({ data: { title: "Hi", body: "Hello" }, done: false });
    expect(s.variants[0]).toEqual({ data: v(0), done: true });
  });

  it("done ghi đè bằng dữ liệu cuối và lưu generationId; finish chuyển sang done", () => {
    const s = run({ type: "start" }, { type: "event", event: { type: "done", generationId: "g1", variants: [v(0), v(1), v(2)] } }, { type: "finish" });
    expect(s.generationId).toBe("g1");
    expect(s.variants.every((x) => x.done)).toBe(true);
    expect(s.status).toBe("done");
  });

  it("lỗi giữ lại phần đã nhận; dừng giữ nguyên nội dung", () => {
    const partial = run({ type: "start" }, { type: "event", event: { type: "delta", index: 0, variant: { title: "x" } } });
    expect(generationReducer(partial, { type: "fail", error: new Error("boom") })).toMatchObject({ status: "error", variants: partial.variants });
    expect(generationReducer(partial, { type: "stop" }).status).toBe("stopped");
  });

  it("finish sau khi đã dừng hoặc lỗi không ghi đè trạng thái", () => {
    const stopped = run({ type: "start" }, { type: "stop" }, { type: "finish" });
    expect(stopped.status).toBe("stopped");
  });

  it("mỗi lần start tăng run để thẻ dựng lại sạch", () => {
    expect(run({ type: "start" }, { type: "start" }).run).toBe(2);
  });
});
