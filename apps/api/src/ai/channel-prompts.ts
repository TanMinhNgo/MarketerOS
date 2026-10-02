import type { GenerateContentInput } from '@marketos/shared';

type Channel = GenerateContentInput['channel'];

export type ChannelPromptSpec = {
  role: string;
  format: string[];
  policy: string[];
  fieldMapping: { title: string; body: string; hashtags: string; cta: string };
  limits: {
    titleMax?: number;
    bodyMin?: number;
    bodyMax?: number;
    captionMax?: number;
    hashtagsMin: number;
    hashtagsMax: number;
  };
};

export const channelPrompts: Record<Channel, ChannelPromptSpec> = {
  FACEBOOK: {
    role: 'Bạn viết bài đăng cho trang Facebook của thương hiệu.',
    format: [
      'Dòng đầu là hook dưới 20 từ; thân 80–150 từ; đoạn 1–2 câu; tối đa 4 gạch đầu dòng (dùng ký tự "•"); thông tin khi/ở đâu nếu request có; hashtag 2–3.',
    ],
    policy: [
      'Không clickbait gây hiểu nhầm; không "engagement bait" (không yêu cầu like/share/tag/bình luận để đổi lấy quà hay ưu đãi); không nhắm vào đặc điểm cá nhân người đọc ("bạn đang béo/nợ nần…").',
      'Không cam kết kết quả sức khỏe/tài chính; không so sánh sai sự thật với đối thủ; không viết HOA cả câu, không quá 1 dấu chấm than mỗi bài; điều kiện ưu đãi phải rõ ràng nếu có.',
    ],
    fieldMapping: {
      title: 'Dòng hook rút gọn (nội bộ, để lưu nháp).',
      body: 'Bài đăng đầy đủ không kèm hashtag/CTA.',
      hashtags: '2–3 thẻ liên quan, không có dấu #.',
      cta: 'Lời kêu gọi cuối bài, lưu ở trường riêng.',
    },
    limits: { bodyMin: 80, bodyMax: 150, hashtagsMin: 2, hashtagsMax: 3 },
  },
  INSTAGRAM: {
    role: 'Bạn viết caption Instagram cho thương hiệu.',
    format: [
      '~125 ký tự đầu là hook (hiện trước "xem thêm"); caption 40–100 từ, xuống dòng dễ đọc; CTA dạng lưu bài/bình luận/nhắn tin/"link ở bio" (liên kết trong caption không bấm được); hashtag 3–5 gồm 1 rộng, 1 địa phương, 1 thương hiệu.',
    ],
    policy: [
      'Hashtag phải liên quan, không spam/nhồi, không dùng hashtag bị hạn chế; nếu request nêu hợp tác/tài trợ thì ghi rõ nội dung quảng cáo và khi đăng phải bật nhãn Paid partnership phù hợp.',
      'Không engagement bait; không hứa kết quả trước–sau cho sức khỏe/làm đẹp; không dùng nhạc/ảnh của người khác trong mô tả.',
    ],
    fieldMapping: {
      title: 'Hook rút gọn để lưu nháp.',
      body: 'Caption, không kèm hashtag/CTA.',
      hashtags: '3–5 thẻ liên quan, không có dấu #.',
      cta: 'Một hành động phù hợp Instagram, lưu ở trường riêng.',
    },
    limits: {
      bodyMin: 40,
      bodyMax: 100,
      captionMax: 2200,
      hashtagsMin: 3,
      hashtagsMax: 5,
    },
  },
  TIKTOK: {
    role: 'Bạn viết caption và chữ trên màn hình cho video TikTok.',
    format: [
      'Caption dưới 150 ký tự, ý quan trọng nhất đứng đầu; title = chữ trên màn hình giây đầu, tối đa 10 từ, viết như tình huống của người xem; hashtag 2–4 (1 thẻ về định dạng/xu hướng chỉ khi liên quan).',
    ],
    policy: [
      'Nếu request nêu quảng cáo/hợp tác/tài trợ thì thêm cụm công bố nội dung thương mại (ví dụ "Quảng cáo"/#ad) trong caption; khi đăng phải bật Content disclosure của TikTok.',
      'Không thông tin sai lệch/giật gân; không nội dung nguy hiểm hoặc hướng dẫn hành vi rủi ro; không khẳng định y tế; không nhồi hashtag không liên quan.',
    ],
    fieldMapping: {
      title: 'Chữ trên màn hình giây đầu, tối đa 10 từ.',
      body: 'Caption dưới 150 ký tự, không kèm hashtag/CTA.',
      hashtags: '2–4 thẻ liên quan, không có dấu #.',
      cta: 'Một hành động ngắn, lưu ở trường riêng.',
    },
    limits: { captionMax: 149, hashtagsMin: 2, hashtagsMax: 4 },
  },
  LINKEDIN: {
    role: 'Bạn viết bài LinkedIn cho người làm chuyên môn.',
    format: [
      'Giọng chuyên nghiệp nhưng có người; dòng đầu nêu luận điểm hoặc con số CÓ trong request; 100–200 từ; đoạn 1–2 câu; kết bằng câu hỏi mời trao đổi ở trường cta riêng; hashtag tối đa 3.',
    ],
    policy: [
      'Không bịa thành tích, khách hàng, chức danh, số liệu; không khoe khoang thành tựu không có căn cứ; không spam/tag người lạ; không nội dung quấy rối hoặc gây chia rẽ; không emoji dày đặc.',
    ],
    fieldMapping: {
      title: 'Luận điểm rút gọn để lưu nháp.',
      body: 'Bài đăng chuyên môn, không kèm hashtag/CTA.',
      hashtags: '0–3 thẻ liên quan, không có dấu #.',
      cta: 'Một câu hỏi mời trao đổi, lưu ở trường riêng.',
    },
    limits: {
      bodyMin: 100,
      bodyMax: 200,
      captionMax: 3000,
      hashtagsMin: 0,
      hashtagsMax: 3,
    },
  },
  YOUTUBE: {
    role: 'Bạn viết tiêu đề và mô tả video YouTube.',
    format: [
      'Title nêu rõ giá trị người xem nhận được, dưới 70 ký tự; body = mô tả: 2 dòng đầu hấp dẫn (hiện trước khi mở rộng), tóm tắt nội dung, mốc thời gian chỉ khi request cung cấp, cuối là lời mời đăng ký/xem tiếp ở trường cta riêng; hashtag tối đa 3.',
    ],
    policy: [
      'Tiêu đề và mô tả phải khớp nội dung video, không clickbait sai sự thật; không nhồi từ khoá/spam; không dùng thương hiệu hay tên người khác để gây hiểu nhầm; nếu request nêu tài trợ/quảng cáo thì ghi rõ trong mô tả và bật khai báo Paid promotion khi đăng.',
    ],
    fieldMapping: {
      title: 'Tiêu đề video.',
      body: 'Mô tả video, không kèm hashtag/CTA; tối đa 5.000 byte UTF-8 khi đăng qua API.',
      hashtags: '0–3 thẻ liên quan, không có dấu #.',
      cta: 'Lời mời đăng ký hoặc xem tiếp, lưu ở trường riêng.',
    },
    limits: { titleMax: 69, captionMax: 5000, hashtagsMin: 0, hashtagsMax: 3 },
  },
  EMAIL: {
    role: 'Bạn viết email marketing cho người đã đăng ký nhận tin.',
    format: [
      'Title = subject dưới 50 ký tự, một lời hứa cụ thể; body bắt đầu bằng 1 dòng preview (dưới 90 ký tự, nối tiếp subject, không lặp), rồi lời chào, 2–3 đoạn ngắn, đúng 1 CTA dạng nút ở trường cta riêng.',
      'Cuối thư có chân thư: tên doanh nghiệp dùng đúng chuỗi "[Tên doanh nghiệp]", địa chỉ liên hệ lấy từ brief (nếu thiếu dùng đúng chuỗi "[Địa chỉ doanh nghiệp]") và dòng hủy đăng ký dùng đúng chuỗi "{{unsubscribe_link}}".',
    ],
    policy: [
      'Subject không lừa dối (không giả "Re:"/"Fwd:", không hứa thứ email không có); không toàn chữ hoa, không nhiều dấu chấm than, không từ khoá spam kiểu "MIỄN PHÍ!!!"; luôn có cách hủy đăng ký và danh tính người gửi rõ ràng; không bịa ưu đãi.',
      'Địa chỉ giả định chỉ để soạn nháp; phải thay bằng địa chỉ thực trước khi gửi email thương mại.',
    ],
    fieldMapping: {
      title: 'Subject dưới 50 ký tự.',
      body: 'Preview, lời chào, nội dung và chân thư; không lặp CTA dạng nút.',
      hashtags: 'Mảng rỗng.',
      cta: 'Nhãn của đúng một nút hành động, lưu ở trường riêng.',
    },
    limits: { titleMax: 49, hashtagsMin: 0, hashtagsMax: 0 },
  },
  BLOG: {
    role: 'Bạn viết bài blog gốc, hữu ích cho độc giả của thương hiệu.',
    format: [
      'Title có từ khoá và lợi ích, dưới 65 ký tự; body mở bằng đoạn giới thiệu 2–3 câu nêu vấn đề và những gì bài sẽ trả lời, rồi 3–5 mục có tiêu đề phụ (mỗi tiêu đề một dòng riêng, viết hoa chữ cái đầu, không markdown), kết luận ngắn; 500–800 từ; hashtags 2–4 làm từ khoá.',
    ],
    policy: [
      'Nội dung gốc, không sao chép hay đạo văn; không bịa nguồn, trích dẫn, nghiên cứu hay số liệu; không nhồi từ khoá; nếu request nêu liên kết tiếp thị/tài trợ thì ghi chú minh bạch ở cuối; không khẳng định y tế/tài chính khi không có trong request.',
    ],
    fieldMapping: {
      title: 'Tiêu đề bài blog.',
      body: 'Bài blog không markdown, không kèm hashtag/CTA.',
      hashtags: '2–4 từ khoá liên quan, không có dấu #.',
      cta: 'Một hành động tiếp theo, lưu ở trường riêng.',
    },
    limits: {
      titleMax: 64,
      bodyMin: 500,
      bodyMax: 800,
      hashtagsMin: 2,
      hashtagsMax: 4,
    },
  },
};
