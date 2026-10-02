"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { useWindowStore } from "./window-store";

/** Nút mở một app (cửa sổ) theo appId, thay cho modal; URL tự đồng bộ qua useUrlSync. */
export function OpenAppButton({ appId, ...props }: { appId: string } & Omit<ComponentProps<typeof Button>, "onClick">) {
  const open = useWindowStore((s) => s.open);
  return <Button {...props} onClick={() => open(appId)} />;
}
