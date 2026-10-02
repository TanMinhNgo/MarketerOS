"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { useWindowStore } from "@/desktop/window-store";
import { embeddedAppearance } from "@/lib/clerk-appearance";

export default function App() {
  const { isSignedIn } = useAuth();
  const close = useWindowStore((s) => s.close);

  // Đăng nhập xong (kể cả khi quay lại từ Google/OAuth) thì đóng cửa sổ này.
  useEffect(() => {
    if (isSignedIn) close("sign-in");
  }, [isSignedIn, close]);

  return (
    <div className="flex min-h-full items-center justify-center p-2">
      <SignIn routing="hash" signUpUrl="/apps/sign-up" fallbackRedirectUrl="/" appearance={embeddedAppearance} />
    </div>
  );
}
