import { create } from "zustand";
import { getCurrentUser } from "../services/firebase/authService";

export const useAuthStore = create((set) => ({
  user: null, // Cache should not be used on initial link open / startup
  loading: false,
  middlewareConnected: false,
  
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setMiddlewareConnected: (connected) => set({ middlewareConnected: connected }),
  
  logout: () => {
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("hayleys_meal_session");
      }
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("hayleys_meal_session");
      }
    } catch {}
    set({ user: null });
  }
}));
