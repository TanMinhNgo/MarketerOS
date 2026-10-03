import type { ComponentType } from "react";

export type AppIconName =
  | "projects"
  | "brief"
  | "studio"
  | "calendar"
  | "assistant"
  | "automations"
  | "plans"
  | "trash"
  | "settings"
  | "integrations"
  | "library"
  | "reports"
  | "account"
  | "docs"
  | "about";

export interface AppManifest {
  id: string;
  title: string;
  /** Mô tả ngắn cho SEO (generateMetadata). */
  description: string;
  icon: AppIconName;
  route: string;
  defaultSize: { w: number; h: number };
  position: "left" | "right";
  /** Ẩn khỏi icon desktop/lưới mobile; chỉ mở bằng nút hoặc URL (vd. Sign in). */
  hidden?: boolean;
  component: () => Promise<{ default: ComponentType }>;
}

/** Desktop chỉ đọc danh sách này; thêm app mới thì icon tự xuất hiện. */
export const apps = [
  {
    id: "projects",
    title: "Projects",
    description: "Manage your marketing projects as folders on the desktop.",
    icon: "projects",
    route: "/apps/projects",
    defaultSize: { w: 720, h: 460 },
    position: "left",
    component: () => import("./projects"),
  },
  {
    id: "brand-brief",
    title: "Brand Brief",
    description: "Fill in a Brand Brief so the AI understands each project's brand.",
    icon: "brief",
    route: "/apps/brand-brief",
    defaultSize: { w: 560, h: 640 },
    position: "left",
    component: () => import("./brand-brief"),
  },
  {
    id: "content-studio",
    title: "Content Studio",
    description: "Generate content variants with AI grounded in your Brand Brief.",
    icon: "studio",
    route: "/apps/content-studio",
    defaultSize: { w: 900, h: 600 },
    position: "left",
    component: () => import("./content-studio"),
  },
  {
    id: "content-calendar",
    title: "Content Calendar",
    description: "Schedule your content on the calendar.",
    icon: "calendar",
    route: "/apps/content-calendar",
    defaultSize: { w: 1000, h: 640 },
    position: "left",
    component: () => import("./content-calendar"),
  },
  {
    id: "ai-assistant",
    title: "AI Assistant",
    description: "Chat about a project with an AI that knows its Brand Brief and posts (Pro).",
    icon: "assistant",
    route: "/apps/ai-assistant",
    defaultSize: { w: 720, h: 640 },
    position: "left",
    component: () => import("./ai-assistant"),
  },
  {
    id: "automations",
    title: "Automations",
    description: "Run drafts, scheduling and weekly reports on a schedule, with your review (Max).",
    icon: "automations",
    route: "/apps/automations",
    defaultSize: { w: 720, h: 640 },
    position: "left",
    component: () => import("./automations"),
  },
  {
    id: "media-library",
    title: "Media Library",
    description: "Images and files for your content.",
    icon: "library",
    route: "/apps/media-library",
    defaultSize: { w: 900, h: 600 },
    position: "left",
    component: () => import("./media-library"),
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connect social channels and external tools.",
    icon: "integrations",
    route: "/apps/integrations",
    defaultSize: { w: 820, h: 560 },
    position: "right",
    component: () => import("./integrations"),
  },
  {
    id: "reports",
    title: "Reports",
    description: "See content performance by project.",
    icon: "reports",
    route: "/apps/reports",
    defaultSize: { w: 880, h: 600 },
    position: "right",
    component: () => import("./reports"),
  },
  {
    id: "plans-billing",
    title: "Plans & Billing",
    description: "View your plan and billing.",
    icon: "plans",
    route: "/apps/plans-billing",
    defaultSize: { w: 780, h: 660 },
    position: "right",
    component: () => import("./plans-billing"),
  },
  {
    id: "trash",
    title: "Trash",
    description: "Restore or permanently delete removed items.",
    icon: "trash",
    route: "/apps/trash",
    defaultSize: { w: 560, h: 400 },
    position: "right",
    component: () => import("./trash"),
  },
  {
    id: "settings",
    title: "Settings",
    description: "Account and workspace settings.",
    icon: "settings",
    route: "/apps/settings",
    defaultSize: { w: 560, h: 420 },
    position: "right",
    component: () => import("./settings"),
  },
  {
    id: "sign-in",
    title: "Sign in",
    description: "Sign in to your MarketOS account.",
    icon: "account",
    route: "/apps/sign-in",
    defaultSize: { w: 460, h: 620 },
    position: "right",
    hidden: true,
    component: () => import("./sign-in"),
  },
  {
    id: "sign-up",
    title: "Sign up",
    description: "Create your MarketOS account.",
    icon: "account",
    route: "/apps/sign-up",
    defaultSize: { w: 460, h: 700 },
    position: "right",
    hidden: true,
    component: () => import("./sign-up"),
  },
  {
    id: "account",
    title: "Account",
    description: "Manage your profile, email and security.",
    icon: "account",
    route: "/apps/account",
    defaultSize: { w: 880, h: 640 },
    position: "right",
    hidden: true,
    component: () => import("./account"),
  },
  {
    id: "pricing",
    title: "Pricing",
    description: "Compare the Free and Pro plans.",
    icon: "plans",
    route: "/apps/pricing",
    defaultSize: { w: 860, h: 640 },
    position: "right",
    hidden: true,
    component: () => import("./pricing"),
  },
  {
    id: "docs",
    title: "Docs",
    description: "Step-by-step guide to using MarketOS, with screenshots.",
    icon: "docs",
    route: "/apps/docs",
    defaultSize: { w: 1000, h: 680 },
    position: "right",
    hidden: true,
    component: () => import("./docs"),
  },
  {
    id: "about",
    title: "About",
    description: "What MarketOS is, who it is for and what is coming next.",
    icon: "about",
    route: "/apps/about",
    defaultSize: { w: 680, h: 640 },
    position: "right",
    hidden: true,
    component: () => import("./about"),
  },
] satisfies AppManifest[];

export const findApp = (id: string): AppManifest | undefined => apps.find((a) => a.id === id);
