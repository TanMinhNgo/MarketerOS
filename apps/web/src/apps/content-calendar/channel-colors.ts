/** Màu theo kênh, dùng cho chip trên lịch và chú giải. */
export const CHANNEL_COLORS: Record<string, string> = {
  FACEBOOK: "#3B82F6",
  INSTAGRAM: "#EC4899",
  TIKTOK: "#111827",
  LINKEDIN: "#6366F1",
  YOUTUBE: "#EF4444",
  EMAIL: "#F59E0B",
  BLOG: "#10B981",
};

export const channelColor = (channel: string) => CHANNEL_COLORS[channel] ?? "#6D5BFF";
