# MarketOS Web

Next.js 16 (App Router) cho giao diện desktop của MarketOS: window manager, các app,
Clerk UI và lớp gọi API. Backend NestJS nằm ở `apps/api`; web không gọi thẳng API mà đi qua
rewrite cùng origin `/api/*` → `${API_URL}/api/*`, nên không cần CORS và cookie Clerk giữ cùng domain.

## Chạy local

Từ root repo (xem [README gốc](../../README.md) để chuẩn bị database và API):

```powershell
npm ci
cp apps/web/.env.example apps/web/.env.local   # điền key Clerk
npm run dev                                    # API trước, web sau khi /api/health sẵn sàng
```

Chạy riêng web (bỏ qua gate chờ API): `npm run build --workspace=@marketos/shared`
rồi `npm run dev --workspace=web`. Mở `http://localhost:3000`.

## Biến môi trường

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Có | Cùng Clerk app với API. Production dùng key `pk_live_…` của Clerk production instance |
| `CLERK_SECRET_KEY` | Có | `sk_live_…` ở production; chỉ đặt phía server |
| `API_URL` | Có ở production | URL gốc của API trên Render, không có `/api` ở cuối (vd. `https://marketos-api.onrender.com`). Rewrite được tính **lúc build**, đổi biến này phải redeploy |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Có | `/apps/sign-in` (đăng nhập là một cửa sổ app) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Có | `/apps/sign-up` |

## Kiểm tra

```powershell
npm run lint --workspace=web
npm run typecheck --workspace=web
npm test --workspace=web
npm run build --workspace=web
```

## Deploy lên Vercel

Cấu hình nằm trong [`vercel.json`](./vercel.json): cài dependency bằng `npm ci` ở root
(một `package-lock.json` cho cả monorepo), build `@marketos/shared` rồi build web.
Build gọi thẳng npm workspace thay vì `turbo run build` vì chế độ env strict của Turbo
lọc bỏ `API_URL`/`CLERK_SECRET_KEY` không khai báo trong `turbo.json`.

1. Vercel → **Add New Project** → import repo GitHub.
2. **Root Directory**: `apps/web`. Framework tự nhận Next.js; giữ Install/Build Command theo `vercel.json`.
3. **Node.js Version**: 24.x (repo yêu cầu Node `>=24.15 <25`).
4. Thêm biến môi trường ở bảng trên cho Production (và Preview nếu cần), với `API_URL` trỏ tới API trên Render.
5. Deploy. Sau khi có domain, thêm domain đó vào Clerk production instance (Domains) và cập nhật
   URL webhook/allowed origins phía API nếu backend yêu cầu.

`next.config.ts` tắt `compress` để Next không đệm luồng SSE của Content Studio và AI Assistant;
Vercel vẫn nén ở tầng CDN.
