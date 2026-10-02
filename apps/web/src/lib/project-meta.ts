import { Briefcase, Folder, Megaphone, Rocket, Sparkles, Store, type LucideIcon } from "lucide-react";

export const PROJECT_ICONS = { folder: Folder, megaphone: Megaphone, rocket: Rocket, store: Store, briefcase: Briefcase, sparkles: Sparkles } satisfies Record<string, LucideIcon>;
export type ProjectIconKey = keyof typeof PROJECT_ICONS;

export const PROJECT_COLORS = ["#6D5BFF", "#FF5D7A", "#3DD68C", "#FFC531", "#38BDF8", "#FF8A5B"];
