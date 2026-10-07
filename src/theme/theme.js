export const themeConfig = {
  token: {
    colorPrimary: "#10b981", // Modern Emerald
    colorSuccess: "#10b981",
    colorWarning: "#f59e0b",
    colorError: "#ef4444",
    colorInfo: "#3b82f6",
    colorBgBase: "#f8fafc",
    colorBgContainer: "#ffffff",
    colorTextBase: "#0f172a",
    colorTextSecondary: "#475569",
    colorBorder: "#e2e8f0",
    colorBorderSecondary: "#f1f5f9",
    borderRadius: 10,
    fontFamily: '"Outfit", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  },
  components: {
    Button: {
      borderRadius: 10,
      controlHeight: 40,
      fontWeight: 600,
      primaryShadow: "0 4px 14px 0 rgba(16, 185, 129, 0.3)",
    },
    Card: {
      borderRadiusLG: 16,
      headerFontSize: 16,
      paddingLG: 20,
    },
    Input: {
      controlHeight: 42,
      borderRadius: 10,
      activeBorderColor: "#10b981",
      hoverBorderColor: "#34d399",
    },
    Select: {
      controlHeight: 42,
      borderRadius: 10,
    },
    Table: {
      borderRadius: 12,
      headerBg: "#f8fafc",
      headerColor: "#475569",
      rowHoverBg: "#f8fafc",
    },
    Tag: {
      borderRadius: 6,
    },
    Modal: {
      borderRadiusLG: 20,
    },
    Drawer: {
      borderRadiusLG: 20,
    }
  }
};
