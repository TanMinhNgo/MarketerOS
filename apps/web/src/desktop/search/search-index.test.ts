import { describe, expect, it } from "vitest";
import { buildResults, flatten, normalize, type SearchSources } from "./search-index";

const src = (over: Partial<SearchSources> = {}): SearchSources => ({
  apps: [
    { id: "projects", title: "Projects", description: "Manage your marketing projects.", icon: "projects" },
    { id: "brand-brief", title: "Brand Brief", description: "Fill in a brief for each project.", icon: "brief" },
    { id: "media-library", title: "Thư viện", description: "Images and files.", icon: "library" },
    { id: "docs", title: "Docs", description: "Step-by-step guide.", icon: "docs", hidden: true },
    { id: "sign-in", title: "Sign in", description: "Sign in.", icon: "account", hidden: true },
  ],
  docs: [
    { id: "windows", title: "Working with windows", summary: "Open, move and resize." },
    { id: "brief", title: "Brand Brief", summary: "Teach the AI about your brand." },
  ],
  projects: [{ id: "p1", name: "Summer Sale", icon: "rocket", color: "#FF5D7A" }],
  signedIn: true,
  ...over,
});

const titles = (q: string, s = src()) => flatten(buildResults(q, s)).map((i) => i.title);

describe("search-index", () => {
  it("bỏ dấu và không phân biệt hoa thường", () => {
    expect(normalize("  Thư Viện Đẹp ")).toBe("thu vien dep");
    expect(titles("THU VIEN")).toContain("Thư viện");
  });

  it("tên bắt đầu bằng từ khoá xếp trước tên chỉ chứa từ khoá", () => {
    const t = titles("pro");
    expect(t.indexOf("Projects")).toBeLessThan(t.indexOf("Brand Brief")); // "Brand Brief" chỉ khớp qua mô tả
  });

  it("gom nhóm theo thứ tự Apps, Actions, Docs, Projects", () => {
    expect(buildResults("brief", src()).map((g) => g.kind)).toEqual(["app", "doc"]);
    expect(buildResults("s", src({ signedIn: false })).map((g) => g.kind)).toContain("action");
  });

  it("mỗi nhóm tối đa 5 kết quả", () => {
    const many = src({ projects: Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `Project ${i}`, icon: null, color: null })) });
    const group = buildResults("project", many).find((g) => g.kind === "project");
    expect(group?.items).toHaveLength(5);
  });

  it("chưa gõ gì thì gợi ý app hiển thị trên desktop và hành động nhanh", () => {
    const groups = buildResults("", src({ signedIn: false }));
    expect(groups.map((g) => g.kind)).toEqual(["app", "action"]);
    expect(groups[0].items.map((i) => i.title)).toEqual(["Projects", "Brand Brief", "Thư viện"]);
    expect(groups[1].items.map((i) => i.title)).toEqual(["Sign in", "Sign up"]);
  });

  it("app đăng nhập không lặp trong Apps, chỉ ở Actions", () => {
    const apps = buildResults("sign", src({ signedIn: false })).find((g) => g.kind === "app");
    expect(apps).toBeUndefined();
    expect(titles("sign", src({ signedIn: false }))).toEqual(["Sign in", "Sign up"]);
  });

  it("dự án chỉ tìm được khi đã đăng nhập; đã đăng nhập thì có Account", () => {
    expect(titles("summer", src({ signedIn: false }))).toEqual([]);
    expect(titles("summer")).toEqual(["Summer Sale"]);
    expect(titles("account")).toEqual(["Account"]);
  });

  it("mục Docs mang theo sectionId để nhảy đúng chỗ", () => {
    const doc = flatten(buildResults("windows", src())).find((i) => i.kind === "doc");
    expect(doc).toMatchObject({ appId: "docs", sectionId: "windows" });
  });

  it("không khớp thì trả mảng rỗng", () => {
    expect(buildResults("zzzzqq", src())).toEqual([]);
  });
});
