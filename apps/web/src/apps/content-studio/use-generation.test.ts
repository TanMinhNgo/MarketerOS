import { describe, expect, it } from "vitest";
import { generationReducer, initialGeneration, type GenerationState } from "./use-generation";

const v = (n: number) => ({ title: `T${n}`, body: `B${n}`, hashtags: [], cta: "" });
const input = { channel: "FACEBOOK" as const, goal: "g", topic: "t" };
const run = (...actions: Parameters<typeof generationReducer>[1][]): GenerationState => actions.reduce(generationReducer, initialGeneration);

describe("generationReducer", () => {
  it("start tạo 3 thẻ trống và đang stream", () => {
    const s = run({ type: "start", input });
    expect(s.status).toBe("streaming");
    expect(s.variants).toHaveLength(3);
    expect(s.variants.every((x) => !x.done)).toBe(true);
  });

  it("delta cộng dồn vào đúng thẻ, variant đánh dấu hoàn tất", () => {
    const s = run(
      { type: "start", input },
      { type: "event", event: { type: "delta", index: 1, variant: { title: "Hi" } } },
      { type: "event", event: { type: "delta", index: 1, variant: { body: "Hello" } } },
      { type: "event", event: { type: "variant", index: 0, variant: v(0) } },
    );
    expect(s.variants[1]).toMatchObject({ data: { title: "Hi", body: "Hello" }, done: false });
    expect(s.variants[0]).toMatchObject({ data: v(0), done: true });
  });

  it("done ghi đè bằng dữ liệu cuối và lưu generationId; finish chuyển sang done", () => {
    const s = run({ type: "start", input }, { type: "event", event: { type: "done", generationId: "g1", variants: [v(0), v(1), v(2)] } }, { type: "finish" });
    expect(s.variants.every((x) => x.done && x.generationId === "g1")).toBe(true);
    expect(s.input).toEqual(input);
    expect(s.status).toBe("done");
  });

  it("lỗi giữ lại phần đã nhận; dừng giữ nguyên nội dung", () => {
    const partial = run({ type: "start", input }, { type: "event", event: { type: "delta", index: 0, variant: { title: "x" } } });
    expect(generationReducer(partial, { type: "fail", error: new Error("boom") })).toMatchObject({ status: "error", variants: partial.variants });
    expect(generationReducer(partial, { type: "stop" }).status).toBe("stopped");
  });

  it("finish sau khi đã dừng hoặc lỗi không ghi đè trạng thái", () => {
    const stopped = run({ type: "start", input }, { type: "stop" }, { type: "finish" });
    expect(stopped.status).toBe("stopped");
  });

  it("mỗi lần start tăng run để thẻ dựng lại sạch", () => {
    expect(run({ type: "start", input }, { type: "start", input }).run).toBe(2);
  });

  it("tạo lại một biến thể: chỉ thẻ đó stream lại, nhận generationId mới, thẻ khác giữ nguyên", () => {
    const done = run({ type: "start", input }, { type: "event", event: { type: "done", generationId: "g1", variants: [v(0), v(1), v(2)] } }, { type: "finish" });
    const regen = generationReducer(done, { type: "regen-start", index: 1 });
    expect(regen.variants[1]).toMatchObject({ data: {}, done: false, rev: 1 });
    expect(regen.variants[0]).toBe(done.variants[0]);
    const after = [
      { type: "event", event: { type: "delta", index: 1, variant: { title: "N" } } },
      { type: "event", event: { type: "done", generationId: "g2", variants: [v(9)] }, index: 1 },
    ].reduce((st, a) => generationReducer(st, a as Parameters<typeof generationReducer>[1]), regen);
    expect(after.variants.map((x) => x.generationId)).toEqual(["g1", "g2", "g1"]);
    expect(after.variants[1].data).toEqual(v(9));
    expect(after.status).toBe("done");
  });

  it("tạo lại lỗi thì trả lại biến thể cũ và dựng lại thẻ", () => {
    const done = run({ type: "start", input }, { type: "event", event: { type: "done", generationId: "g1", variants: [v(0), v(1), v(2)] } });
    const prev = done.variants[2];
    const back = generationReducer(generationReducer(done, { type: "regen-start", index: 2 }), { type: "regen-restore", index: 2, prev });
    expect(back.variants[2]).toMatchObject({ data: v(2), done: true, generationId: "g1", rev: 2 });
  });
});
