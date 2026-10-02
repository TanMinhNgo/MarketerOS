# MarketOS — hướng dẫn cho Claude Code

Đọc `AGENTS.md` ở root để biết phân công và quy tắc phối hợp.

**Claude Code phụ trách frontend trong `apps/web/`; Codex phụ trách backend trong `apps/api/`.**
Không sửa backend trừ khi người dùng giao rõ ràng. Khi thiếu API, mô tả contract cần backend
và báo phần tích hợp đang chờ; không coi mock frontend là API đã triển khai.

Đọc `apps/web/AGENTS.md` và `packages/docs/prompts/00-CLAUDE.md` trước khi triển khai.
Các tài liệu kiến trúc, tech stack, data model và roadmap nằm trong `packages/docs/`.
Với `packages/shared/` và cấu hình chung, tuân thủ quy tắc bàn giao trong `AGENTS.md`.
