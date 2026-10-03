import { cookies } from "next/headers";
import { Desktop } from "@/desktop/Desktop";
import { parseSkyPref, SKY_COOKIE, skyMinutes } from "@/desktop/sky-pref";

// Desktop nằm ở layout nên không bị mount lại khi đổi giữa "/" và "/apps/[appId]".
// children vẫn phải render để page chạy (notFound, metadata).
// Cảnh trời theo giờ thật và tuỳ chọn trong cookie: đọc cookie nên render theo từng request, HTML đã đúng cảnh.
export default async function DesktopLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pref = parseSkyPref((await cookies()).get(SKY_COOKIE)?.value);
  return (
    <>
      <Desktop skyMinutes={skyMinutes(pref)} />
      {children}
    </>
  );
}
