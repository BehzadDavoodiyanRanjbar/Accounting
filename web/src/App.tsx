import { App as AntApp, ConfigProvider } from 'antd';
import faIR from 'antd/locale/fa_IR';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CompanyProvider } from './api/CompanyContext';
import { getToken, goLogin } from './api/client';
import AppLayout from './layout/AppLayout';
import ViewRoute from './pages/ViewRoute';
import { appTheme } from './theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

export default function App() {
  // بدون نشست معتبر، به صفحهٔ ورود برمی‌گردیم (همان ورود نسخهٔ فعلی)
  if (!getToken()) {
    goLogin();
    return null;
  }
  return (
    <ConfigProvider direction="rtl" locale={faIR} theme={appTheme}>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <CompanyProvider>
            <HashRouter>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route index element={<Navigate to="/p/dash" replace />} />
                  <Route path="contracts" element={<Navigate to="/p/cs_ct" replace />} />
                  <Route path="p/:view" element={<ViewRoute />} />
                  <Route path="*" element={<Navigate to="/p/dash" replace />} />
                </Route>
              </Routes>
            </HashRouter>
          </CompanyProvider>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}
