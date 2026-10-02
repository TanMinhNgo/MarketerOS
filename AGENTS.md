# MarketOS — phân công AI coding

## Phân công đã chốt

- **Codex phụ trách backend:** `apps/api/`, Prisma schema/migration, Clerk phía server,
  OpenAI, quota/billing phía server, kiểm thử backend và hạ tầng phục vụ backend.
- **Claude Code phụ trách frontend:** `apps/web/`, UI desktop, window manager, routing,
  Clerk UI, gọi API và kiểm thử frontend. Đọc thêm `apps/web/AGENTS.md` trước khi sửa frontend.
- Mỗi AI sửa trong phạm vi phụ trách; thay đổi phía còn lại cần người dùng giao rõ ràng.
  Giữ nguyên các thay đổi đang có của người dùng và AI còn lại.

## Phần dùng chung và bàn giao

Phân phase và quy trình phối hợp chi tiết: `packages/docs/07-team-split.md`.

- `packages/shared/`, cấu hình monorepo và tài liệu là phần dùng chung.
  Codex phụ trách contract API/schema phía backend; Claude Code sử dụng contract để tích hợp frontend.
- Khi thay đổi contract, cập nhật schema/tài liệu liên quan và nêu endpoint, request/response,
  auth, mã lỗi và ảnh hưởng đến frontend trong bàn giao. Phân biệt API đã chạy với API dự kiến.
- Tránh cùng sửa một file dùng chung trong cùng thời điểm; nêu rõ file dùng chung sắp sửa khi bắt đầu.
- Chỉ triển khai phase được giao. Không tự commit hoặc push khi chưa được yêu cầu.

## Quyết định kỹ thuật

- npm; Next.js/NestJS latest stable khi khởi tạo hoặc nâng cấp, giữ lockfile.
- PostgreSQL: `pgvector/pgvector:pg16`; Redis: `redis:8.6`.
- Authentication và gói đăng ký: Clerk / Clerk Billing.
- AI chỉ dùng OpenAI; `OPENAI_API_KEY` và `AI_MODEL` nằm phía backend.
- Đọc tài liệu hiện tại trong `packages/docs/` trước khi triển khai; báo rõ kiểm tra đã chạy và giới hạn.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
