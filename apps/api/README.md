# MarketOS API

API NestJS đã setup phần nền tảng: env validation, Prisma/PostgreSQL, health check,
Swagger, ValidationPipe, CORS và lỗi thống nhất. Schema 16 bảng có initial migration kèm
13 CHECK constraint. Đã có Clerk guard, /me, Projects/Trash/restore và Brand Brief.
Catalog Free/Pro nằm trong @marketos/shared (PLAN_CATALOG, PlanKey, FeatureKey): Pro 10 USD/tháng.
Catalog là mô tả sản phẩm, không cấp quyền hay quyết định giá checkout; Clerk là nguồn quyền/giao dịch.
Phase 4 có AI tạo 3 biến thể chữ qua SSE, ContentItem nháp và quota TEXT theo gói.
Quota IMAGE đã định cấu hình cho phase tạo ảnh sau; project cap, storage, API billing,
cá nhân hóa, publishing và worker chưa triển khai.

## Chạy local

Từ repo root, cần Docker Desktop đang chạy:

```powershell
docker compose up -d postgres
# Chỉ copy lần đầu; không ghi đè .env đang có.
if (-not (Test-Path apps/api/.env)) { Copy-Item apps/api/.env.example apps/api/.env }
npm run build --workspace @marketos/shared
npm run prisma:generate --workspace api
npm run db:deploy --workspace api
npm run dev --workspace api
```

DATABASE_URL mẫu chỉ dành cho PostgreSQL dev của MarketOS trên localhost:5433.
Database/volume riêng, không dùng PostgreSQL đang có trên cổng 5432. Cấu hình production
phải dùng DATABASE_URL/WEB_URL thật qua env; không dùng credentials dev của Compose.
Redis thuộc profile jobs, chưa cần chạy cho API nền tảng.

API tự đọc apps/api/.env, kể cả khi chạy dist/main.js; env của tiến trình ưu tiên hơn file.
PORT mặc định 3001; DATABASE_URL, WEB_URL, OPENAI_API_KEY và AI_MODEL bắt buộc.
Điền hai biến OpenAI trực tiếp vào apps/api/.env (không gửi key qua chat/commit);
thiếu biến thì backend dừng khi khởi động. AI_MODEL là mã model OpenAI hỗ trợ
structured output. Không có key thật thì chỉ chạy được test với OpenAiService giả lập.
Điền CLERK_SECRET_KEY và CLERK_PUBLISHABLE_KEY trực tiếp vào apps/api/.env rồi restart API.
Không gửi key qua chat hoặc commit .env. Backend dùng Clerk authenticateRequest chỉ nhận
session token, authorizedParties = origin WEB_URL và bắt buộc azp khớp origin đó.
Development có thể chạy health/docs khi thiếu cả hai keys; route bảo vệ không bỏ qua auth:
thiếu Bearer trả 401, có Bearer nhưng thiếu cấu hình Clerk trả 503. Production yêu cầu đủ keys
ngay lúc startup. Webhook user.deleted đã triển khai; cần CLERK_WEBHOOK_SECRET của endpoint Clerk.
Thiếu webhook secret chỉ làm route webhook trả 503, không bỏ qua verify.
Không triển khai demo-ticket.

## Endpoint đã triển khai

| Endpoint | Auth | Response |
|---|---|---|
| GET /api/health | Public | 200: { status: 'ok', db: 'up' }; SELECT 1 qua Prisma |
| GET /docs | Public | Swagger UI |
| GET /docs-json | Public | OpenAPI JSON |
| POST /api/webhooks/clerk | Chữ ký Svix (không Bearer) | 200: { received: true }; user.deleted xóa User và cascade DB |
| GET /api/me | Bearer Clerk | MeResponse: id, clerkId, email?, name?, isDemo, plan, createdAt |
| GET /api/projects?page=1&limit=20 | Bearer Clerk | ProjectListResponse: items, page, limit, total |
| GET /api/projects/trash?page=1&limit=20 | Bearer Clerk | Danh sách project đã xóa mềm của user |
| POST /api/projects | Bearer Clerk | 201 ProjectResponse; input name, color?, icon? |
| GET /api/projects/:projectId | Bearer Clerk | 200 ProjectResponse đang hoạt động |
| PATCH /api/projects/:projectId | Bearer Clerk | 200 ProjectResponse; ít nhất một trường name/color/icon |
| DELETE /api/projects/:projectId | Bearer Clerk | 200 ProjectResponse có deletedAt; không xóa vĩnh viễn |
| POST /api/projects/:projectId/restore | Bearer Clerk | 201 ProjectResponse; không cần body |
| GET /api/projects/:projectId/brand-brief | Bearer Clerk | 200 BrandBriefResponse; chưa có brief trả 404 |
| PUT /api/projects/:projectId/brand-brief | Bearer Clerk | 200 BrandBriefResponse; create/update một brief |
| POST /api/projects/:projectId/generate | Bearer Clerk + Idempotency-Key UUID | 200 SSE: variant.delta, variant.done, done/error; cần Brand Brief |
| GET /api/projects/:projectId/contents | Bearer Clerk | 200 ContentListResponse; page/limit/status tùy chọn |
| POST /api/projects/:projectId/contents | Bearer Clerk | 201 ContentResponse; lưu DRAFT, generationId tùy chọn |
| GET /api/projects/:projectId/contents/:contentId | Bearer Clerk | 200 ContentResponse |
| PATCH /api/projects/:projectId/contents/:contentId | Bearer Clerk | 200 ContentResponse; sửa title/body/hashtags/cta |
| DELETE /api/projects/:projectId/contents/:contentId | Bearer Clerk | 200 ContentResponse; xóa nội dung |

ProjectResponse gồm id, name, color, icon, deletedAt, createdAt, updatedAt; timestamps ISO 8601.
Không nhận ownerId từ client. icon theo enum shared; color null hoặc hex #RRGGBB.
PATCH cho phép bỏ từng trường hoặc đặt color/icon null, không nhận name rỗng.
List giới hạn 1–100, mặc định 20, page từ 1; thứ tự createdAt desc rồi id desc.

PUT brief thay toàn bộ trường: product, audience, tone bắt buộc; keyMessages/avoidWords/
samplePosts/brandColors mặc định [], visualStyle mặc định null. Response thêm id, projectId,
createdAt, updatedAt. Dùng giới hạn độ dài/mảng đúng packages/shared/src/core.ts.
`language` thuộc `ContentLanguageSchema` (`vi`, `en`, `zh`, `ja`, `ko`, `th`, `id`, `fr`,
`es`, `de`), mặc định `vi`; `businessAddress` tối đa 300 ký tự, trim và chuyển chuỗi
rỗng thành null. Response luôn có hai trường này. Client cũ PUT không gửi chúng sẽ
đặt lại `vi`/null; frontend nên gửi đủ giá trị hiện tại khi lưu brief.
Payload field lạ bị từ chối; API validate trực tiếp bằng shared Zod qua SchemaPipe,
Swagger chuyển cùng schema sang OpenAPI 3.0, không duy trì bản DTO validation trùng lặp.

Mọi tài nguyên của user khác trả 404/NOT_FOUND. Project trong Trash không được GET/PATCH
hoặc đọc/ghi brief; restore giữ nguyên brief. DELETE lần hai/restore project đang active trả 404.
Trash hủy publication QUEUED và invalidate BehaviorProfile trong cùng transaction.
Chưa có giới hạn số project theo gói (phase billing); không tự áp dụng roadmap khác.

User được lazy upsert theo clerkId, safe với request đầu đồng thời. Chỉ lấy profile Clerk khi
chưa có User; /me dùng dữ liệu profile local và plan free/pro từ token đã verify, không lưu plan.
Không có test header hoặc auth bypass trong production.

Lỗi Prisma kết nối/auth DB/timeout/pool đã nhận diện (P1000/P1001/P1002/P1008/P1017/P2024 hoặc ECONNREFUSED/ECONNRESET/ETIMEDOUT/ENOTFOUND): HTTP 503, { code: 'SERVICE_UNAVAILABLE', message, details: null }.
Health kiểm tra kết nối DB; không kiểm tra từng bảng, Clerk, OpenAI, Redis hoặc worker.
Route không tồn tại trả 404/NOT_FOUND. Endpoint GET / Hello World đã được bỏ.

Global prefix /api; CORS chỉ origin từ WEB_URL. ValidationPipe chặn field lạ và trả
VALIDATION với details gồm field/constraints. Exception filter không trả raw server error.
Shared contract: packages/shared/src/index.ts và errors.ts. Generated Prisma Client
nằm trong src/generated/prisma, được gitignore; prebuild/predev tự generate.

Frontend đã có rewrite /api trong apps/web/next.config.ts, chuyển /api/* sang API_URL
(mặc định http://localhost:3001). API client gắn Bearer token Clerk cho request bảo vệ.
Content và AI chữ đã có API; billing và các nhóm DB mở rộng vẫn chờ phase tiếp theo.

## Phase 4: tạo nội dung và quota

POST generate nhận JSON `{ channel, goal, topic, notes? }`, yêu cầu project đang hoạt động,
Brand Brief đã có, Bearer token và header `Idempotency-Key` là UUID mới cho mỗi lần tạo.
Một lần sinh đúng 3 biến thể, tính 1 lượt TEXT. Gửi lại cùng key trả 409 CONFLICT và
không gọi OpenAI lần nữa. SSE dùng `event:` và JSON trong `data:`:
`variant.delta` có `{ index, variant }` (variant chưa đầy đủ),
`variant.done` có biến thể đã hoàn chỉnh, `done` có `{ generationId, variants }`.
Lỗi sau khi mở stream gửi `error` với `{ code, message, details }`; lỗi trước stream dùng
HTTP chuẩn. SSE có no-cache/no-transform và không bật compression; frontend cần kiểm tra
stream qua Next rewrite có hiện dần hay không.

Quota tạm áp dụng theo tháng UTC: Free 10 lượt TEXT/2 ảnh, Pro 200 lượt TEXT/50 ảnh.
IMAGE chưa có API nên chưa tiêu quota. Reservation ghi `Generation` trước khi gọi OpenAI;
FAILED/CANCELLED vẫn tính lượt để kiểm soát chi phí. 429 QUOTA_EXCEEDED trả
`details: { limit, used, resetAt }`; 429 RATE_LIMITED là giới hạn 10 request/phút/IP.
Request bị ngắt hoặc server chết có thể để lại PENDING; lần tạo sau đánh dấu bản ghi
PENDING quá 30 phút thành FAILED, vẫn tính quota và không gọi lại provider.
Hạn mức này là giả định triển khai khi chưa có quyết định sản phẩm cuối cùng.

POST contents chỉ lưu DRAFT. Nếu gắn generationId, backend xác minh Generation đã
SUCCEEDED, cùng user/project/kênh. GET/PATCH/DELETE chỉ truy cập nội dung thuộc project
đang hoạt động; project của người khác hoặc đang trong Trash trả 404.

## Prompt theo kênh và kiểm tra đầu ra (đối chiếu 02/10/2026)

Mỗi kênh có role, định dạng, chính sách, ánh xạ trường và giới hạn riêng trong
`src/ai/channel-prompts.ts`. `body` không lặp CTA/hashtag; hashtag lưu không có `#`.
Validator đếm từ bằng khoảng trắng, ký tự bằng Unicode code point, kiểm tra từ cấm
không phân biệt hoa/thường và dấu tiếng Việt. Một đầu ra sai được tạo lại đúng một lần
trong cùng Generation/idempotency key/quota unit; vẫn sai thì SSE `error`, không cắt chữ.
Kiểm tra quy tắc ngữ nghĩa (ví dụ có bịa số liệu hay không) vẫn cần người dùng duyệt nháp.

| Kênh | Nguồn chính thức đã xem | Phân biệt với quy tắc sản phẩm |
|---|---|---|
| Facebook | [Meta: engagement bait](https://about.fb.com/news/2017/12/news-feed-fyi-fighting-engagement-bait-on-facebook/), [Meta: advertising standards](https://transparency.meta.com/policies/ad-standards/) | 80–150 từ, 2–3 hashtag, tối đa 1 `!` là mục tiêu biên tập; hạn chế đặc điểm cá nhân ở chuẩn quảng cáo được áp dụng thận trọng cho nháp thường. |
| Instagram | [Instagram Community Guidelines](https://www.facebook.com/help/477434105621119), [Meta: branded content](https://www.facebook.com/help/instagram/616901995832907) | 40–100 từ, 3–5 hashtag và 2.200 ký tự là giới hạn dự án; chưa xác minh được giới hạn ký tự caption từ tài liệu chính thức công khai. Paid partnership label cần bật ở luồng đăng, văn bản công bố chưa thay thế nhãn. |
| TikTok | [TikTok: Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post), [TikTok: content disclosure](https://support.tiktok.com/en/business-and-creator/creator-and-business-accounts/promoting-a-brand-product-or-service) | API cho caption tối đa 2.200 UTF-16 runes; dự án cố ý giới hạn body dưới 150 ký tự. Đăng nội dung thương mại còn cần bật disclosure/toggle khi đăng. |
| LinkedIn | [LinkedIn: post limit](https://www.linkedin.com/help/linkedin/answer/a522483/differences-between-posting-updates-and-publishing), [Professional Community Policies](https://www.linkedin.com/legal/professional-community-policies) | Bài đăng tối đa 3.000 ký tự; 100–200 từ và 0–3 hashtag là mục tiêu dự án. |
| YouTube | [YouTube Studio limits](https://support.google.com/youtube/answer/57407), [YouTube Data API limits](https://developers.google.com/youtube/v3/docs/videos), [paid promotion](https://support.google.com/youtube/answer/154235) | Title dưới 70 thay vì tối đa 100 ký tự. Giao diện ghi mô tả 5.000 ký tự, API giới hạn 5.000 byte UTF-8; validator áp cả hai để nháp dùng được qua API. Cần bật khai báo paid promotion khi đăng. |
| Email | [FTC: CAN-SPAM guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) | Subject dưới 50, preview dưới 90, không hashtag là quy tắc dự án. Email dùng `businessAddress` khi có; nếu thiếu dùng `[Địa chỉ doanh nghiệp]`. `[Tên doanh nghiệp]` vẫn là placeholder vì brief chưa có tên pháp nhân riêng. `{{unsubscribe_link}}` cũng phải được thay bằng liên kết hoạt động trước khi gửi. Quy định pháp lý tùy thị trường gửi. |
| Blog | [Google Search: people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | 500–800 từ, title dưới 65 và 2–4 từ khóa là quy tắc biên tập của dự án; Google không yêu cầu độ dài bài cố định. |

Chưa xác minh chính thức được các mốc hook Facebook 20 từ, Instagram 125 ký tự,
các mức hashtag tối ưu, danh sách hashtag bị hạn chế và tất cả quy tắc độ dài theo từ;
chúng là hướng dẫn biên tập, không được trình bày như giới hạn của nền tảng. Brand Brief
hiện chưa có trường tên doanh nghiệp tách riêng nên email vẫn dùng placeholder tên;
cần dữ liệu người gửi thật và cơ chế hủy đăng ký trước khi tự động gửi email thương mại.

## Migration và kiểm tra

```powershell
npm run prisma:validate --workspace api
npm run db:migrate --workspace api -- --name ten_thay_doi
npm run db:deploy --workspace api
npm run build --workspace api
npm run typecheck --workspace api
npm run lint --workspace api
npm test --workspace api
npm run test:e2e --workspace api
npm run test:db --workspace api
```

Review migration trước khi apply; các CHECK nghiệp vụ cần giữ trong migration SQL.
Jest cơ sở mock Prisma cho health/503/404/Swagger/CORS. Core e2e chỉ chạy khi TEST_DATABASE_URL
được cấu hình: PostgreSQL test riêng đã migrate, ClerkGateway được mock; guard, services,
repositories và transactions chạy thật. Test tạo user ngẫu nhiên và xóa riêng user test sau suite.
Không đặt TEST_DATABASE_URL trỏ vào database production. Suite core skip nếu thiếu biến này.

```powershell
# Chuẩn bị database test riêng, rồi dùng URL của nó cho migrate và e2e:
if (-not $env:TEST_DATABASE_URL) { throw 'Cần đặt TEST_DATABASE_URL cho database test riêng.' }
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:deploy --workspace api
Remove-Item Env:DATABASE_URL
npm run test:e2e --workspace api -- --runInBand
```

Unit test Clerk dùng RSA/JWT tạo trong bộ nhớ với SDK thật, kiểm tra signature/expiry/azp và
plan; không gọi Clerk thật. test:db kiểm tra CHECK/quota bằng transaction rollback.
Kiểm tra Phase 2 được ghi ở CONTRACT-CHANGES.md. Test cục bộ dùng SDK Clerk/Svix và DB test thật;
không coi kết quả đó là xác minh phiên browser hoặc delivery từ Clerk Dashboard.
Keys Clerk local đã được người dùng cấu hình; Backend API Clerk đã kết nối thật thành công.
Chưa xác minh token phiên browser gọi backend thật hoặc delivery webhook từ Dashboard.

Dùng ConfigModule theo [NestJS](https://docs.nestjs.com/techniques/configuration) và Prisma config
cho [Prisma 7](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference).
Clerk auth dùng [authenticateRequest](https://clerk.com/docs/reference/backend/authenticate-request).

## Webhook Clerk

Cấu hình Clerk Dashboard endpoint `https://<api-domain>/api/webhooks/clerk`, subscribe `user.deleted`.
Local cần public HTTPS tunnel trỏ vào API:3001; localhost không nhận delivery từ Clerk.
Điền CLERK_WEBHOOK_SECRET trực tiếp trong .env, restart API; không gửi secret/token qua chat.

Body JSON phải giữ nguyên byte đã ký; verify svix-id, svix-timestamp, svix-signature bằng Svix.
400 VALIDATION: thiếu raw body/header hoặc payload user.deleted thiếu id; 401 UNAUTHORIZED:
chữ ký sai, payload bị sửa hoặc timestamp hết hạn; 503 SERVICE_UNAVAILABLE: thiếu secret/DB outage;
429 RATE_LIMITED: quá 120 request/IP/phút. Không có Bearer trên route này.
Sự kiện hợp lệ khác được ACK 200 mà không mutate DB. deleteMany theo clerkId nên retry/ID đã xóa
vẫn ACK 200; lỗi DB không ACK thành công để Clerk retry. Chỉ cascade DB theo FK; không xóa file
ở object storage hoặc bài đăng bên ngoài (các tích hợp này chưa triển khai).

Rate limit dùng memory của từng process, chưa dùng Redis. Chỉ tin IP của proxy khi đã cấu hình
proxy đáng tin cậy; không tự bật trust proxy để nhận X-Forwarded-For tùy ý.
Test e2e tạo chữ ký bằng secret test riêng, không dùng secret hay xóa tài khoản Clerk thật.

Tham khảo: [Clerk webhooks](https://clerk.com/docs/guides/development/webhooks/syncing),
[NestJS rate limiting](https://docs.nestjs.com/security/rate-limiting).
