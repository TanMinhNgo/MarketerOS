import { create } from "zustand";

interface DocsNav {
  /** Section đang xem; null = section đầu tiên. */
  sectionId: string | null;
  go: (id: string) => void;
}

/** Cho phép nơi khác (vd. hộp tìm kiếm) mở Docs đúng section. */
export const useDocsNav = create<DocsNav>()((set) => ({ sectionId: null, go: (sectionId) => set({ sectionId }) }));
