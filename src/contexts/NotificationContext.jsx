import React, { createContext, useContext, useRef, useCallback } from "react";
import { notification } from "antd";

const NotificationContext = createContext(null);

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const audioRef = useRef(null);

  // Play success audio chime (matching the original Python Flet success_music.mp3)
  const playSuccessChime = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio("/success_music.mp3");
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((e) => console.log("Audio autoplay suppressed:", e));
    } catch (e) {
      console.warn("Audio playback error:", e);
    }
  }, []);

  const showNotification = useCallback((type, title, description) => {
    if (type === "success") {
      playSuccessChime();
    }
    notification[type]({
      message: title,
      description,
      placement: "topRight",
      duration: 3.5,
    });
  }, [playSuccessChime]);

  return (
    <NotificationContext.Provider value={{ showNotification, playSuccessChime }}>
      {children}
    </NotificationContext.Provider>
  );
};
