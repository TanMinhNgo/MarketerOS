# MarketOS

Monorepo npm workspaces: NestJS API, Next.js web và Zod contract dùng chung.
Codex phụ trách backend; Claude Code phụ trách frontend. Xem [AGENTS.md](./AGENTS.md).

## Cài đặt và chạy

Chạy từ root project, dùng Node 24.15 trở lên trong nhánh 24 LTS và npm 12.
`.node-version` ghi phiên bản 24.21.0; dev dependency `node` cung cấp Node 24.21.0
cho các npm script. Dùng npm 12.1.0 để cài dependencies. npm 12 nhận đúng override trong workspace;
các bản npm cũ có thể báo dependency đã override là invalid.

```powershell
npm ci
npm run dev
```

Web: `http://localhost:3000`; API: `http://localhost:3001`.
Hiện API là NestJS starter với `GET /`; các module nghiệp vụ mới là khung trống.
Chưa kết nối Clerk, PostgreSQL hay OpenAI. `apps/api/.env.example` là mẫu cho bước triển khai tiếp theo.

Nếu Node của máy thấp hơn 24.15, có thể cài lần đầu bằng Node tạm từ npm:

```powershell
npx --yes --package=node@24.21.0 --package=npm@12.1.0 npm ci
```

## Kiểm tra

```powershell
npm run build
npm run typecheck
npm run lint
npm test
npm run test:e2e --workspace=api -- --runInBand
```

Chạy một app: `npm run dev --workspace=api` hoặc `npm run dev --workspace=web`.
Build `packages/shared` trước khi chạy riêng app: `npm run build --workspace=@marketos/shared`.

## Dependency và TypeScript

- Các dependency trực tiếp được đối chiếu npm registry ngày 30/09/2026 và pin phiên bản cụ thể;
  dùng một `package-lock.json` ở root để cài lặp lại bằng `npm ci`.
- NestJS 12, Next.js 16, React 19; OpenAI qua Vercel AI SDK; Clerk; Prisma với PostgreSQL adapter.
- TypeScript 6.0.3 là bản mới nhất tương thích với typescript-eslint và ts-jest hiện tại.
  TypeScript 7 chưa phù hợp với toolchain backend này; không dùng cờ bỏ qua peer dependency.
- Prisma CLI/client/adapter cùng 7.10.0 stable; dist-tag latest của CLI hiện trỏ vào 8.0.0 RC.
- Dùng class-validator/class-transformer vì nestjs-zod chưa công bố hỗ trợ NestJS 12.
- `@types/node` dùng bản mới nhất nhánh 24 để khớp runtime Node 24 LTS.
- Toàn repo dùng ESLint 9.39.5 vì các plugin của Next.js chưa hỗ trợ ESLint 10.
- Các optional peer Ajv của react-hook-form resolver được cài đúng range: Ajv 8 và ajv-formats 2.
  Giữ cùng phiên bản ESLint cho frontend/backend để tránh xung đột peer khi npm hoist package.
- Override deepmerge-ts và mysql2 trong dependency của Prisma bằng bản đã vá;
  giữ CLI/client/adapter Prisma cùng phiên bản stable.
- `allowScripts` cho phép các script cài binary của Node, Prisma và native build tools theo phiên bản
  đã kiểm tra, để npm 12 cài đủ chúng. Không thêm npm CLI vào dependency của ứng dụng.
- `tsconfig.base.json` bật strict. API/shared dùng NodeNext; web dùng bundler theo Next.js.
  Backend build chỉ nhận `src`, không đưa test vào output; shared xuất JS và declaration cho cả hai app.
- Dependencies UI cho shadcn/ui đã cài; component sẽ do Claude Code tạo theo nhu cầu.
  BullMQ/Redis client sẽ thêm khi triển khai worker ở phase mở rộng.

Docker theo tài liệu: `pgvector/pgvector:pg16` và `redis:8.6`.
`docker-compose.yml` hiện chưa được triển khai.
