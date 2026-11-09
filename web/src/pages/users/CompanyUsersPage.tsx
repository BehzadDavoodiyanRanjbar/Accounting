import { CopyOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Alert, Button, Card, Drawer, Input, Modal, Segmented, Space, Switch, Table, Tag, Typography, Select } from 'antd';
import type { TableColumnsType } from 'antd';
import { useState } from 'react';
import { callApi, errorMessage } from '../../api/client';

const { Text, Paragraph } = Typography;

type Level = 'r' | 'w';
type Perms = Record<string, Level>;
interface Role { key: string; name: string; perms: Perms }
interface Section { key: string; label: string }
interface CoUser { id: string; username: string; fullName: string; owner: boolean; staff: boolean; staffRole: string; perms: Perms; active: boolean; lastLogin: string }
interface Invite { id: string; fullName: string; email: string; role: string; perms: Perms; at: number; expires: number }
interface CoUsers { mail: boolean; sections: Section[]; roles: Role[]; users: CoUser[]; invites: Invite[] }

const fmtDate = (v: string | number) => {
  const d = typeof v === 'number' ? new Date(v) : new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fa-IR');
};

function PermsEditor({ sections, value, onChange }: { sections: Section[]; value: Perms; onChange: (p: Perms) => void }) {
  return (
    <div style={{ border: '1px solid #f0f0f0', borderRadius: 8 }}>
      {sections.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', borderTop: i ? '1px solid #f5f5f5' : undefined, flexWrap: 'wrap' }}>
          <Text>{s.label}</Text>
          <Segmented
            size="small"
            value={value[s.key] ?? 'none'}
            options={[{ label: 'بدون دسترسی', value: 'none' }, { label: 'مشاهده', value: 'r' }, { label: 'مشاهده و ویرایش', value: 'w' }]}
            onChange={(v) => {
              const n = { ...value };
              if (v === 'none') delete n[s.key];
              else n[s.key] = v as Level;
              onChange(n);
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default function CompanyUsersPage() {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['coUsers'], queryFn: () => callApi<CoUsers>('coUsers', {}) });
  const data = q.data;
  const reload = () => qc.invalidateQueries({ queryKey: ['coUsers'] });

  const [edit, setEdit] = useState<null | { id?: string; fullName: string; email: string; role: string; perms: Perms; active: boolean }>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<null | { link: string; mailed: boolean; mailError?: string; name: string }>(null);
  const [pw, setPw] = useState<null | { id: string; name: string; value: string }>(null);

  const roleName = (k: string) => data?.roles.find((r) => r.key === k)?.name ?? 'سفارشی';
  const summary = (p: Perms) => {
    const e = Object.keys(p);
    if (!e.length) return 'بدون دسترسی';
    const w = e.filter((k) => p[k] === 'w').length;
    return `${e.length} بخش (${w} با ویرایش)`;
  };

  const setRole = (role: string) => {
    const r = data?.roles.find((x) => x.key === role);
    setEdit((e) => (e ? { ...e, role, perms: r && role !== 'custom' ? { ...r.perms } : e.perms } : e));
  };

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      if (edit.id) {
        await callApi('coUserSave', { id: edit.id, fullName: edit.fullName, role: edit.role, perms: edit.perms, active: edit.active });
        message.success('ذخیره شد.');
      } else {
        const r = await callApi<{ link: string; mailed: boolean; mailError?: string }>('coInvite', { fullName: edit.fullName, email: edit.email, role: edit.role, perms: edit.perms });
        setLink({ ...r, name: edit.fullName });
      }
      setEdit(null);
      await reload();
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      message.success('کپی شد.');
    } catch {
      message.info('کپی خودکار ممکن نشد؛ پیوند را دستی انتخاب و کپی کنید.');
    }
  };

  const userCols: TableColumnsType<CoUser> = [
    { title: 'نام', dataIndex: 'fullName', render: (v: string, r: CoUser) => <span>{v} {r.owner ? <Tag color="blue">مدیر شرکت</Tag> : null}</span> },
    { title: 'نام کاربری', dataIndex: 'username', render: (v: string) => <span dir="ltr">{v}</span> },
    { title: 'نقش', render: (_v: unknown, r: CoUser) => (r.owner ? 'دسترسی کامل' : roleName(r.staffRole)) },
    { title: 'دسترسی‌ها', render: (_v: unknown, r: CoUser) => (r.owner ? 'همهٔ بخش‌ها' : summary(r.perms)) },
    { title: 'آخرین ورود', dataIndex: 'lastLogin', render: (v: string) => fmtDate(v) || '—' },
    { title: 'وضعیت', dataIndex: 'active', render: (v: boolean) => (v ? <Tag color="green">فعال</Tag> : <Tag>غیرفعال</Tag>) },
    {
      title: 'عملیات',
      render: (_v: unknown, r: CoUser) =>
        r.owner ? null : (
          <Space>
            <Button size="small" onClick={() => setEdit({ id: r.id, fullName: r.fullName, email: '', role: r.staffRole, perms: { ...r.perms }, active: r.active })}>ویرایش دسترسی</Button>
            <Button size="small" onClick={() => setPw({ id: r.id, name: r.fullName, value: '' })}>رمز موقت</Button>
          </Space>
        ),
    },
  ];

  const invCols: TableColumnsType<Invite> = [
    { title: 'نام', dataIndex: 'fullName' },
    { title: 'ایمیل', dataIndex: 'email', render: (v: string) => <span dir="ltr">{v}</span> },
    { title: 'نقش', render: (_v: unknown, r: Invite) => roleName(r.role) },
    { title: 'اعتبار تا', dataIndex: 'expires', render: (v: number) => fmtDate(v) },
    {
      title: 'عملیات',
      render: (_v: unknown, r: Invite) => (
        <Space>
          <Button
            size="small"
            onClick={async () => {
              try {
                const x = await callApi<{ link: string; mailed: boolean }>('coInviteResend', { id: r.id });
                setLink({ link: x.link, mailed: x.mailed, name: r.fullName });
                await reload();
              } catch (e) {
                message.error(errorMessage(e));
              }
            }}
          >
            ارسال مجدد
          </Button>
          <Button
            size="small"
            danger
            onClick={() =>
              modal.confirm({
                title: 'لغو دعوت',
                content: `دعوت «${r.fullName}» لغو شود؟ پیوند قبلی دیگر کار نمی‌کند.`,
                okText: 'لغو دعوت',
                cancelText: 'انصراف',
                onOk: async () => {
                  await callApi('coInviteCancel', { id: r.id });
                  await reload();
                },
              })
            }
          >
            لغو
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="کاربران شرکت (کارکنان)"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({ fullName: '', email: '', role: 'accountant', perms: { ...(data?.roles.find((r) => r.key === 'accountant')?.perms ?? {}) }, active: true })}>
          دعوت کارمند
        </Button>
      }
    >
      <Paragraph type="secondary">
        کارکنان خود را با ایمیل دعوت کنید؛ هر کارمند نام کاربری و رمز خودش را می‌سازد و فقط به بخش‌هایی که شما تعیین می‌کنید (مشاهده یا ویرایش) و فقط به اطلاعات همین شرکت دسترسی دارد. حساب مدیر شرکت و تنظیمات، پشتیبان‌گیری و ورود از Excel فقط برای شما باقی می‌ماند.
      </Paragraph>
      {data && !data.mail ? <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="ایمیل روی این سرور تنظیم نشده است؛ بعد از ثبت دعوت، پیوند را خودتان برای کارمند بفرستید (پیام‌رسان یا ایمیل شخصی)." /> : null}
      {q.error ? <Alert type="error" showIcon message={errorMessage(q.error)} style={{ marginBottom: 12 }} /> : null}
      <Table<CoUser> rowKey="id" size="small" loading={q.isLoading} columns={userCols} dataSource={data?.users ?? []} pagination={false} scroll={{ x: 'max-content' }} />
      {data?.invites.length ? (
        <>
          <Typography.Title level={5} style={{ marginTop: 24 }}>دعوت‌های در انتظار پذیرش</Typography.Title>
          <Table<Invite> rowKey="id" size="small" columns={invCols} dataSource={data.invites} pagination={false} scroll={{ x: 'max-content' }} />
        </>
      ) : null}

      <Drawer open={!!edit} onClose={() => setEdit(null)} width={520} title={edit?.id ? 'ویرایش دسترسی کارمند' : 'دعوت کارمند جدید'} destroyOnClose
        footer={<Space><Button type="primary" loading={busy} onClick={save}>{edit?.id ? 'ذخیره' : 'ثبت و ارسال دعوت'}</Button><Button onClick={() => setEdit(null)}>انصراف</Button></Space>}>
        {edit ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div><Text>نام و نام خانوادگی</Text><Input value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} maxLength={80} /></div>
            {!edit.id ? <div><Text>ایمیل کارمند</Text><Input dir="ltr" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="name@example.com" /></div> : null}
            <div>
              <Text>نقش (پیش‌فرض دسترسی‌ها)</Text>
              <Select style={{ width: '100%' }} value={edit.role} onChange={setRole} options={(data?.roles ?? []).map((r) => ({ value: r.key, label: r.name }))} />
              <Text type="secondary" style={{ fontSize: 12 }}>با انتخاب نقش، دسترسی‌ها خودکار پر می‌شود و می‌توانید آن‌ها را تغییر دهید.</Text>
            </div>
            <div>
              <Text>حدود دسترسی</Text>
              <PermsEditor sections={data?.sections ?? []} value={edit.perms} onChange={(perms) => setEdit({ ...edit, perms, role: edit.role === 'custom' ? 'custom' : edit.role })} />
            </div>
            {edit.id ? <div><Switch checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} /> <Text>حساب فعال باشد</Text></div> : null}
            <Text type="secondary" style={{ fontSize: 12 }}>«مشاهده»: فقط دیدن اطلاعات؛ «مشاهده و ویرایش»: ثبت، ویرایش و حذف در آن بخش. دسترسی‌ها پس از ذخیره بلافاصله اعمال می‌شود.</Text>
          </Space>
        ) : null}
      </Drawer>

      <Modal open={!!link} onCancel={() => setLink(null)} footer={<Button type="primary" onClick={() => setLink(null)}>بستن</Button>} title="دعوت ثبت شد">
        {link ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>{link.mailed ? `ایمیل دعوت برای «${link.name}» فرستاده شد.` : `ایمیل ارسال نشد${link.mailError ? ` (${link.mailError})` : ''}؛ پیوند زیر را خودتان برای «${link.name}» بفرستید.`}</Text>
            <Input readOnly dir="ltr" value={link.link} addonAfter={<CopyOutlined onClick={() => copy(link.link)} />} onFocus={(e) => e.target.select()} />
            <Text type="secondary" style={{ fontSize: 12 }}>این پیوند ۷ روز اعتبار دارد و فقط یک‌بار قابل استفاده است. هر کس آن را داشته باشد می‌تواند حساب بسازد؛ آن را فقط برای خود کارمند بفرستید.</Text>
          </Space>
        ) : null}
      </Modal>

      <Modal open={!!pw} onCancel={() => setPw(null)} title={`رمز موقت برای ${pw?.name ?? ''}`} okText="تعیین رمز" cancelText="انصراف"
        onOk={async () => {
          if (!pw) return;
          try {
            await callApi('coUserPassword', { id: pw.id, password: pw.value });
            message.success('رمز موقت تعیین شد؛ کارمند در اولین ورود باید رمز جدید بگذارد.');
            setPw(null);
          } catch (e) {
            message.error(errorMessage(e));
          }
        }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.Password dir="ltr" value={pw?.value ?? ''} onChange={(e) => setPw(pw ? { ...pw, value: e.target.value } : pw)} placeholder="رمز موقت (حداقل ۸ کاراکتر، حرف و عدد)" />
          <Text type="secondary" style={{ fontSize: 12 }}>نشست‌های فعلی این کارمند بسته می‌شود.</Text>
        </Space>
      </Modal>
    </Card>
  );
}
