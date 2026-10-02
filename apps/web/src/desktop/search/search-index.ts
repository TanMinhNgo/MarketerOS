import type { AppIconName } from "../../apps/registry";

export type ResultKind = "app" | "action" | "doc" | "project";

export interface SearchItem {
  /** Khoá ổn định, dùng làm id của option. */
  id: string;
  kind: ResultKind;
  title: string;
  subtitle?: string;
  /** App sẽ mở (kind = app | action | doc | project). */
  appId: string;
  sectionId?: string;
  projectId?: string;
  icon?: AppIconName;
  projectIcon?: string | null;
  color?: string | null;
}

export interface SearchGroup {
  kind: ResultKind;
  label: string;
  items: SearchItem[];
}

export interface SearchSources {
  apps: { id: string; title: string; description: string; icon: AppIconName; hidden?: boolean }[];
  docs: { id: string; title: string; summary: string }[];
  projects: { id: string; name: string; icon: string | null; color: string | null }[];
  signedIn: boolean;
}

const GROUP_LIMIT = 5;
const EMPTY_APPS = 6;
/** Các app đăng nhập/tài khoản xuất hiện dưới dạng Actions, không lặp lại trong Apps. */
const ACCOUNT_APPS = new Set(["sign-in", "sign-up", "account"]);
const LABELS: Record<ResultKind, string> = { app: "Apps", action: "Actions", doc: "Docs", project: "Projects" };

/** Hạ chữ thường và bỏ dấu (kể cả đ) để gõ "thu vien" vẫn ra "Thư viện". */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .trim();

/** 3 = bắt đầu bằng, 2 = bắt đầu một từ, 1 = có chứa, 0 = không khớp. */
function score(text: string, q: string): number {
  const t = normalize(text);
  if (t.startsWith(q)) return 3;
  if (t.split(/[^a-z0-9]+/).some((w) => w.startsWith(q))) return 2;
  return t.includes(q) ? 1 : 0;
}

/** Tên khớp quan trọng hơn mô tả. */
const best = (title: string, subtitle: string | undefined, q: string) => Math.max(score(title, q) * 2, subtitle ? score(subtitle, q) : 0);

function rank(items: SearchItem[], q: string): SearchItem[] {
  return items
    .map((item) => ({ item, s: best(item.title, item.subtitle, q) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s) // sort ổn định: hoà điểm thì giữ thứ tự gốc
    .slice(0, GROUP_LIMIT)
    .map((r) => r.item);
}

export function buildResults(query: string, src: SearchSources): SearchGroup[] {
  const q = normalize(query);

  const apps: SearchItem[] = src.apps
    .filter((a) => !ACCOUNT_APPS.has(a.id))
    .map((a) => ({ id: `app:${a.id}`, kind: "app", title: a.title, subtitle: a.description, appId: a.id, icon: a.icon }));
  const actions: SearchItem[] = src.signedIn
    ? [{ id: "action:account", kind: "action", title: "Account", subtitle: "Profile, email and security", appId: "account", icon: "account" }]
    : [
        { id: "action:sign-in", kind: "action", title: "Sign in", subtitle: "Open your MarketOS account", appId: "sign-in", icon: "account" },
        { id: "action:sign-up", kind: "action", title: "Sign up", subtitle: "Create a free account", appId: "sign-up", icon: "account" },
      ];
  const docs: SearchItem[] = src.docs.map((d) => ({ id: `doc:${d.id}`, kind: "doc", title: d.title, subtitle: d.summary, appId: "docs", sectionId: d.id, icon: "docs" }));
  const projects: SearchItem[] = src.signedIn
    ? src.projects.map((p) => ({ id: `project:${p.id}`, kind: "project", title: p.name, subtitle: "Project", appId: "projects", projectId: p.id, projectIcon: p.icon, color: p.color }))
    : [];

  // Chưa gõ gì: gợi ý các app chính và hành động nhanh.
  if (!q) {
    const visible = src.apps.filter((a) => !a.hidden);
    const suggested = apps.filter((a) => visible.some((v) => `app:${v.id}` === a.id)).slice(0, EMPTY_APPS);
    return [
      { kind: "app" as const, label: LABELS.app, items: suggested },
      { kind: "action" as const, label: LABELS.action, items: actions },
    ].filter((g) => g.items.length > 0);
  }

  return [
    { kind: "app" as const, items: rank(apps, q) },
    { kind: "action" as const, items: rank(actions, q) },
    { kind: "doc" as const, items: rank(docs, q) },
    { kind: "project" as const, items: rank(projects, q) },
  ]
    .filter((g) => g.items.length > 0)
    .map((g) => ({ ...g, label: LABELS[g.kind] }));
}

export const flatten = (groups: SearchGroup[]): SearchItem[] => groups.flatMap((g) => g.items);
