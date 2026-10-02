import { create } from "zustand";

interface SearchStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** Trạng thái mở/đóng hộp tìm kiếm, dùng chung giữa nút trên MenuBar và SearchPalette. */
export const useSearch = create<SearchStore>()((set) => ({ open: false, setOpen: (open) => set({ open }) }));
