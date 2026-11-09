import type { ThemeConfig } from 'antd';

/**
 * توکن‌های طراحی مرکزی (Design Tokens) — تنها جایی که رنگ، فاصله، گوشه و فونت تعریف می‌شود.
 * هیچ صفحه‌ای نباید رنگ یا اندازهٔ ثابت (hardcode) بنویسد؛ از این توکن‌ها یا theme.useToken() استفاده شود.
 */
export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1d4ed8',
    colorInfo: '#1d4ed8',
    colorSuccess: '#16a34a',
    colorWarning: '#d97706',
    colorError: '#dc2626',
    borderRadius: 8,
    fontFamily: "'Vazirmatn', Tahoma, sans-serif",
    fontSize: 14,
    controlHeight: 36,
  },
  components: {
    Table: { headerBg: '#eef2ff', headerColor: '#1e3a8a', cellPaddingBlock: 10 },
    Layout: { siderBg: '#ffffff', headerBg: '#ffffff' },
  },
};
