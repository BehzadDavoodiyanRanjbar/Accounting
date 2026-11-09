import { KeyOutlined, LogoutOutlined, RollbackOutlined, MenuOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Drawer, Dropdown, Grid, Layout, Menu, Select, Space, Spin, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { UI_FEATURES, UI_VERSION } from '../version';
import { goLogin } from '../api/client';
import { useCompany } from '../api/CompanyContext';
import { ChangePasswordModal } from './ChangePasswordModal';
import { useSelectedFy } from '../pages/accounting/common';
import { FY_BAR_HEIGHT, FiscalYearBar } from './FiscalYearBar';
import { GROUPS, canView, labelOf, menuKeyOf, visibleKeys } from './menu';

const { Header, Sider, Content } = Layout;

/** چیدمان اصلی: منوی گروه‌بندی‌شدهٔ همهٔ بخش‌ها، انتخاب شرکت، منوی کاربر */
export default function AppLayout() {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const nav = useNavigate();
  const loc = useLocation();
  const { company, setCompany, companies, me, loading, error } = useCompany();
  const [drawer, setDrawer] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const fySel = useSelectedFy(company);

  const isAdmin = me?.role === 'admin';
  const selected = /^\/p\/([^/]+)/.exec(loc.pathname)?.[1] ?? 'dash';

  const items = useMemo<MenuProps['items']>(() => {
    const top: MenuProps['items'] = canView('dash', me ?? undefined) ? [{ key: 'dash', label: labelOf('dash', isAdmin) }] : [];
    const groups = GROUPS.map((g) => {
      const keys = visibleKeys(g.keys, me ?? undefined);
      if (g.flat) return keys.length ? { key: keys[0], label: labelOf(keys[0], isAdmin) } : null;
      return keys.length ? { key: `g:${g.title}`, label: g.title, children: keys.map((k) => ({ key: k, label: labelOf(k, isAdmin) })) } : null;
    }).filter(Boolean) as NonNullable<MenuProps['items']>;
    return [...top, ...groups];
  }, [isAdmin, me]);

  const openGroup = GROUPS.find((g) => !g.flat && g.keys.includes(selected));
  const [openKeys, setOpenKeys] = useState<string[]>(openGroup ? [`g:${openGroup.title}`] : []);

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[menuKeyOf(selected)]}
      openKeys={openKeys}
      onOpenChange={(k) => setOpenKeys(k)}
      onClick={({ key }) => {
        nav(`/p/${key}`);
        setDrawer(false);
      }}
      items={items}
      style={{ borderInlineEnd: 0 }}
    />
  );

  const title = (
    <div style={{ padding: 16 }}>
      <Typography.Title level={5} style={{ margin: 0 }}>
        حسابداری ۶ سطحی معین تراز
      </Typography.Title>
      {!isAdmin && me?.companyName ? <Typography.Text type="secondary">{me.companyName}</Typography.Text> : null}
    </div>
  );

  const userMenu: MenuProps = {
    items: [
      { key: 'pw', icon: <KeyOutlined />, label: 'تغییر رمز من' },
      { key: 'old', icon: <RollbackOutlined />, label: 'نسخهٔ قبلی برنامه' },
      { key: 'out', icon: <LogoutOutlined />, label: 'خروج', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'pw') setPwOpen(true);
      else if (key === 'old') window.location.assign('/app?legacy=1');
      else goLogin();
    },
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile ? (
        <Sider className="app-sider" width={260} theme="light" style={{ borderInlineEnd: `1px solid ${token.colorBorderSecondary}` }}>
          {title}
          <div className="menu-scroll">{menu}</div>
        </Sider>
      ) : (
        <Drawer open={drawer} onClose={() => setDrawer(false)} placement="right" width={280} styles={{ body: { padding: 0 } }} title="حسابداری ۶ سطحی معین تراز">
          <div className="menu-scroll menu-scroll-drawer">{menu}</div>
        </Drawer>
      )}
      <Layout>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingInline: 16, background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <Space>
            {isMobile ? <Button icon={<MenuOutlined />} onClick={() => setDrawer(true)} aria-label="منو" /> : null}
            {isAdmin ? (
              <>
                {!isMobile ? <Typography.Text type="secondary">شرکت فعال:</Typography.Text> : null}
                <Select
                  style={{ minWidth: isMobile ? 160 : 260 }}
                  value={company || undefined}
                  onChange={setCompany}
                  loading={loading}
                  placeholder="انتخاب شرکت"
                  options={companies.map((c) => ({ value: c.CompanyID, label: c.Name }))}
                  showSearch
                  optionFilterProp="label"
                />
              </>
            ) : (
              <Typography.Text>{me?.companyName}</Typography.Text>
            )}
          </Space>
          <Space>
            {!isMobile ? (
              <Typography.Text type="secondary" style={{ fontSize: 11 }} title={UI_FEATURES}>
                رابط {UI_VERSION}
              </Typography.Text>
            ) : null}
            <Dropdown menu={userMenu} trigger={['click']}>
              <Button icon={<UserOutlined />}>{me?.fullName || me?.username}</Button>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ padding: 16, paddingBottom: 16 + FY_BAR_HEIGHT, minWidth: 0 }}>
          {error ? <Alert type="error" showIcon message="بارگذاری اطلاعات اولیه انجام نشد" description={error} style={{ marginBlockEnd: 16 }} /> : null}
          {loading ? <Spin /> : company ? <div key={`${company}:${fySel}`}><Outlet /></div> : <Alert type="warning" showIcon message="شرکتی برای نمایش وجود ندارد." />}
        </Content>
      </Layout>
      {!loading && company ? <FiscalYearBar /> : null}
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </Layout>
  );
}
