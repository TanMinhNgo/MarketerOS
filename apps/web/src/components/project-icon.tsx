import type { CSSProperties } from "react";
import { PROJECT_ICONS, type ProjectIconKey } from "@/lib/project-meta";

/** Biểu tượng dự án theo khoá của backend; khoá lạ hoặc null thì dùng thư mục. */
export function ProjectIcon({ name, className, style }: { name: string | null; className?: string; style?: CSSProperties }) {
  const Icon = PROJECT_ICONS[(name ?? "folder") as ProjectIconKey] ?? PROJECT_ICONS.folder;
  return <Icon className={className} style={style} />;
}
