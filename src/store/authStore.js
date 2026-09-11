import { create } from "zustand";
import { getCurrentUser } from "../services/firebase/authService";

export const useAuthStore = create((set) => ({
  user: getCurrentUser(),
  loading: false,
  middlewareConnected: false,
  
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setMiddlewareConnected: (connected) => set({ middlewareConnected: connected }),
  
  logout: () => {
    localStorage.removeItem("hayleys_meal_session");
    set({ user: null });
  }
}));
