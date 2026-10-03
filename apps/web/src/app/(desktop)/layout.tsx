import { connection } from "next/server";
import { Desktop } from "@/desktop/Desktop";
import { vnMinutes } from "@/desktop/sky";

// Desktop nằm ở layout nên không bị mount lại khi đổi giữa "/" và "/apps/[appId]".
// children vẫn phải render để page chạy (notFound, metadata).
// Cảnh trời theo giờ thật: render theo từng request (không prerender lúc build) để HTML đã đúng giờ.
export default async function DesktopLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <>
      <Desktop skyMinutes={vnMinutes()} />
      {children}
    </>
  );
}
