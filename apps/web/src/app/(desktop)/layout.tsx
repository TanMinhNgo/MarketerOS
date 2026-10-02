import { Desktop } from "@/desktop/Desktop";

// Desktop nằm ở layout nên không bị mount lại khi đổi giữa "/" và "/apps/[appId]".
// children vẫn phải render để page chạy (notFound, metadata).
export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Desktop />
      {children}
    </>
  );
}
