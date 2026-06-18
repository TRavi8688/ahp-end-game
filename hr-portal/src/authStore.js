import { create } from "zustand";
import { persist } from "zustand/middleware";

const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      hospitalId: null,

      login: (token, user, hospitalId) =>
        set({ token, user, hospitalId }),

      logout: () =>
        set({ token: null, user: null, hospitalId: null }),
    }),
    {
      name: "hr-auth",
      getStorage: () => sessionStorage,
    }
  )
);

export default useAuthStore;
