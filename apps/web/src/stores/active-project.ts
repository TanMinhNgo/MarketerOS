import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ActiveProjectStore {
  activeId: string | null;
  setActive: (id: string | null) => void;
}

/** Dự án đang chọn (dùng chung giữa Projects, Brand Brief và MenuBar); nhớ qua F5. */
export const useActiveProject = create<ActiveProjectStore>()(
  persist((set) => ({ activeId: null, setActive: (activeId) => set({ activeId }) }), { name: "marketos.active-project" }),
);
