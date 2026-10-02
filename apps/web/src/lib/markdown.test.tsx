import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

const html = (text: string) => renderToStaticMarkup(<Markdown text={text} />);

describe("Markdown", () => {
  it("đậm, nghiêng, code, link http(s)", () => {
    const out = html("Đăng vào **thứ Bảy, 19:00** nhé, *thử* `A/B`, xem [docs](https://x.dev)");
    expect(out).toContain("<strong>thứ Bảy, 19:00</strong>");
    expect(out).toContain("<em>thử</em>");
    expect(out).toContain(">A/B</code>");
    expect(out).toContain('href="https://x.dev"');
  });

  it("không render HTML thô và không nhận link javascript:", () => {
    const out = html('<img src=x onerror=alert(1)> [x](javascript:alert(1))');
    expect(out).not.toContain("<img");
    expect(out).not.toContain("href=");
  });

  it("đoạn, danh sách gạch đầu dòng / đánh số, tiêu đề", () => {
    const out = html("## Kế hoạch\nDòng 1\nDòng 2\n\n- a\n- **b**\n\n1. x\n2. y");
    expect(out).toContain('<p class="font-semibold">Kế hoạch</p>');
    expect(out).toContain("<p>Dòng 1<br/>Dòng 2</p>");
    expect(out).toMatch(/<ul[^>]*><li>a<\/li><li><strong>b<\/strong><\/li><\/ul>/);
    expect(out).toMatch(/<ol[^>]*><li>x<\/li><li>y<\/li><\/ol>/);
  });

  it("dấu ** chưa đóng (đang stream) giữ nguyên chữ", () => {
    expect(html("Khoảng **19:00")).toContain("Khoảng **19:00");
  });

  it("chuỗi dài nhiều dấu * vẫn chạy tuyến tính (không backtrack)", () => {
    const start = performance.now();
    html("**a".repeat(20_000));
    html("[a](x ".repeat(2_000));
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it("đậm chứa nghiêng", () => {
    expect(html("**a *b* c**")).toContain("<strong>a <em>b</em> c</strong>");
  });
});
