export const themeConfig = {
  token: {
    colorPrimary: "#10b981", // Hayleys Eco Green
    colorSuccess: "#10b981",
    colorWarning: "#f59e0b",
    colorError: "#ef4444",
    colorInfo: "#6366f1",
    colorBgBase: "#f8fafc",
    colorBgContainer: "#ffffff",
    borderRadius: 12,
    fontFamily: '"Outfit", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)",
  },
  components: {
    Button: {
      borderRadius: 10,
      controlHeight: 40,
      fontWeight: 600,
      primaryShadow: "0 4px 14px 0 rgba(16, 185, 129, 0.35)",
    },
    Card: {
      borderRadiusLG: 16,
      colorBorderSecondary: "#f1f5f9",
      headerFontSize: 16,
    },
    Input: {
      controlHeight: 42,
      borderRadius: 10,
    },
    Select: {
      controlHeight: 42,
      borderRadius: 10,
    },
    Table: {
      borderRadius: 12,
      headerBg: "#f8fafc",
      headerColor: "#475569",
      rowHoverBg: "#f1f5f9",
    },
    Tag: {
      borderRadius: 6,
    },
    Modal: {
      borderRadiusLG: 18,
    }
  }
};
