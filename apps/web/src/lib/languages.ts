import type { ContentLanguage } from "@marketos/shared";

/** Tên hiển thị cho từng ngôn ngữ nội dung. Kiểu Record buộc cập nhật khi backend thêm mã mới. */
export const LANGUAGES: Record<ContentLanguage, { label: string; native: string }> = {
  vi: { label: "Vietnamese", native: "Tiếng Việt" },
  en: { label: "English", native: "English" },
  zh: { label: "Chinese", native: "中文" },
  ja: { label: "Japanese", native: "日本語" },
  ko: { label: "Korean", native: "한국어" },
  th: { label: "Thai", native: "ไทย" },
  id: { label: "Indonesian", native: "Bahasa Indonesia" },
  fr: { label: "French", native: "Français" },
  es: { label: "Spanish", native: "Español" },
  de: { label: "German", native: "Deutsch" },
};

export const LANGUAGE_CODES = Object.keys(LANGUAGES) as ContentLanguage[];
