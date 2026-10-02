import { apps, findApp } from "../apps/registry";

export const HOME = "/";

/** Đường dẫn của app đang focus, hoặc "/" khi không có cửa sổ nào. */
export const routeFor = (appId: string | null): string => (appId && findApp(appId)?.route) || HOME;

/** appId ứng với pathname, hoặc null nếu là "/" hay đường dẫn lạ. */
export function appIdFromPath(pathname: string): string | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return apps.find((a) => a.route === clean)?.id ?? null;
}
