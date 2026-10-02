import { clerkMiddleware } from "@clerk/nextjs/server";

// Không bảo vệ route nào: desktop render cho khách, từng app tự hiện trạng thái "Đăng nhập".
export default clerkMiddleware();

export const config = {
  matcher: [
    // Bỏ qua file tĩnh và nội bộ của Next
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Luôn chạy cho /api để Clerk đọc được session
    "/(api|trpc)(.*)",
  ],
};
