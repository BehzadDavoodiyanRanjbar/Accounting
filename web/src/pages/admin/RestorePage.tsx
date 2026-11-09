import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Alert, Button, Card, Input, Modal, Space, Table, Tag, Typography, Upload } from 'antd';
import type { TableColumnsType } from 'antd';
import { useState } from 'react';
import { callApi, errorMessage, getToken } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { fmtNum } from '../../kit/format';

interface BkFile {
  file: string;
  kind: 'full' | 'company' | 'upload';
  name: string;
  size: number;
  mtime: string;
}
interface PvCompany {
  id: string;
  name: string;
  records: number;
  exists: boolean;
  currentName: string;
  currentRecords: number;
}
interface Preview {
  type: 'full' | 'company';
  at: string;
  companies: PvCompany[];
}
interface RunResult {
  safety: string;
  results: { id: string; ok: boolean; deleted?: number; inserted?: number; created?: boolean; error?: string; rolledBack?: boolean }[];
}

const kindLabel = (f: BkFile) => {
  if (f.kind === 'company') return 'پشتیبان یک شرکت';
  if (f.kind === 'upload') return 'فایل بارگذاری‌شده';
  return f.name.startsWith('restore-safety') ? 'پشتیبان خودکار پیش از بازگردانی' : 'پشتیبان کامل سیستم';
};
const sizeText = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} مگابایت` : `${Math.max(1, Math.round(n / 1024))} کیلوبایت`);
const dateText = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('fa-IR');
  } catch {
    return iso;
  }
};
const dlUrl = (f: BkFile) => `${f.kind === 'company' ? '/backup/company/' : '/backup/'}${f.name}?t=${encodeURIComponent(getToken())}`;

/** بازگردانی پشتیبان (فقط مدیر سیستم): تکی برای یک شرکت یا گروهی برای چند/همهٔ شرکت‌ها */
export default function RestorePage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { reload, me } = useCompany();
  const list = useQuery({ queryKey: ['backupList'], queryFn: () => callApi<BkFile[]>('backupList') });
  const [file, setFile] = useState<string>('');
  const [pv, setPv] = useState<Preview | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [word, setWord] = useState('');
  const [res, setRes] = useState<RunResult | null>(null);

  if (me && me.role !== 'admin') return <Alert type="error" showIcon message="این بخش فقط برای مدیر سیستم است." />;

  const choose = async (f: string) => {
    setBusy(true);
    setRes(null);
    try {
      const p = await callApi<Preview>('restorePreview', { file: f });
      setFile(f);
      setPv(p);
      setSel(p.type === 'company' ? p.companies.map((c) => c.id) : []);
    } catch (e) {
      setFile('');
      setPv(null);
      message.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (f: File) => {
    setBusy(true);
    try {
      const r = await fetch(`/backup/upload?t=${encodeURIComponent(getToken())}`, { method: 'POST', body: f });
      const j = (await r.json()) as { ok: boolean; file?: string; error?: string };
      if (!j.ok || !j.file) throw new Error(j.error || 'بارگذاری انجام نشد.');
      await list.refetch();
      await choose(j.file);
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
    return false;
  };

  const makeFull = async () => {
    setBusy(true);
    try {
      await callApi('backup');
      message.success('پشتیبان کامل جدید ساخته شد.');
      await list.refetch();
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    setBusy(true);
    try {
      const r = await callApi<RunResult>('restoreRun', { file, companies: sel });
      setRes(r);
      setConfirm(false);
      setWord('');
      await qc.invalidateQueries();
      await reload();
      await list.refetch();
      const bad = r.results.filter((x) => !x.ok).length;
      if (bad) message.warning(`${bad} شرکت بازگردانی نشد؛ جزئیات را ببینید.`);
      else message.success('بازگردانی انجام شد.');
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const fileCols: TableColumnsType<BkFile> = [
    { title: 'نوع', dataIndex: 'kind', render: (_: unknown, f) => <Tag>{kindLabel(f)}</Tag> },
    { title: 'نام فایل', dataIndex: 'name', render: (v: string) => <span dir="ltr">{v}</span> },
    { title: 'حجم', dataIndex: 'size', render: (v: number) => sizeText(v) },
    { title: 'تاریخ', dataIndex: 'mtime', render: (v: string) => dateText(v) },
    {
      title: 'عملیات',
      key: 'a',
      render: (_: unknown, f) => (
        <Space>
          <Button size="small" type={f.file === file ? 'primary' : 'default'} onClick={() => void choose(f.file)}>
            انتخاب برای بازگردانی
          </Button>
          {f.kind !== 'upload' ? (
            <Button size="small" href={dlUrl(f)}>
              دانلود
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  const coCols: TableColumnsType<PvCompany> = [
    { title: 'شرکت', dataIndex: 'name', render: (v: string, c) => v || c.id },
    { title: 'شناسه', dataIndex: 'id' },
    { title: 'رکوردهای داخل فایل', dataIndex: 'records', align: 'end', render: (v: number) => fmtNum(v) },
    {
      title: 'وضعیت فعلی',
      key: 's',
      render: (_: unknown, c) => (c.exists ? <Tag color="blue">موجود ({fmtNum(c.currentRecords)} رکورد فعلی)</Tag> : <Tag color="green">وجود ندارد؛ ساخته می‌شود</Tag>),
    },
  ];

  const nameOf = (id: string) => pv?.companies.find((c) => c.id === id)?.name || id;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        message="بازگردانی، اطلاعات فعلی شرکت‌های انتخاب‌شده را با محتوای فایل جایگزین می‌کند."
        description="پیش از هر بازگردانی، از کل سیستم یک پشتیبان خودکار گرفته می‌شود و در همین فهرست می‌ماند. کاربران و تنظیمات سیستم بازگردانی نمی‌شوند؛ فقط اطلاعات شرکت‌ها (کالا، فاکتور، بانک، اسناد حسابداری و ...)."
      />
      <Card
        title="۱. انتخاب فایل پشتیبان"
        extra={
          <Space>
            <Button onClick={() => void makeFull()} loading={busy}>
              ساخت پشتیبان کامل جدید
            </Button>
            <Upload accept=".gz,.json,.bak" showUploadList={false} beforeUpload={(f) => upload(f)}>
              <Button type="primary" loading={busy}>
                بارگذاری فایل پشتیبان از کامپیوتر
              </Button>
            </Upload>
          </Space>
        }
      >
        <Table<BkFile> rowKey="file" size="small" loading={list.isLoading} columns={fileCols} dataSource={list.data ?? []} pagination={{ pageSize: 8, hideOnSinglePage: true }} locale={{ emptyText: 'هنوز فایلی در سرور نیست؛ یک فایل بارگذاری کنید.' }} />
      </Card>

      {pv ? (
        <Card
          title="۲. انتخاب شرکت‌ها و بازگردانی"
          extra={
            pv.type === 'full' ? (
              <Space>
                <Button size="small" onClick={() => setSel(pv.companies.map((c) => c.id))}>
                  انتخاب همهٔ شرکت‌ها
                </Button>
                <Button size="small" onClick={() => setSel([])}>
                  لغو انتخاب
                </Button>
              </Space>
            ) : null
          }
        >
          <Typography.Paragraph type="secondary">
            {pv.type === 'full' ? 'فایل پشتیبان کامل سیستم است. شرکت یا شرکت‌های دلخواه را انتخاب کنید (برای بازگردانی گروهی همه را انتخاب کنید).' : 'فایل پشتیبان یک شرکت است.'} تاریخ ساخت فایل: {pv.at}
          </Typography.Paragraph>
          <Table<PvCompany>
            rowKey="id"
            size="small"
            columns={coCols}
            dataSource={pv.companies}
            pagination={false}
            rowSelection={{ selectedRowKeys: sel, onChange: (k) => setSel(k as string[]) }}
          />
          <div style={{ marginTop: 12 }}>
            <Button type="primary" danger disabled={!sel.length} onClick={() => setConfirm(true)}>
              بازگردانی {sel.length ? `${fmtNum(sel.length)} شرکت انتخاب‌شده` : ''}
            </Button>
          </div>
        </Card>
      ) : null}

      {res ? (
        <Card title="نتیجهٔ بازگردانی">
          <Typography.Paragraph>
            پشتیبان خودکار پیش از بازگردانی: <b dir="ltr">{res.safety}</b>
          </Typography.Paragraph>
          <Space direction="vertical" style={{ width: '100%' }}>
            {res.results.map((r) =>
              r.ok ? (
                <Alert key={r.id} type="success" showIcon message={`${nameOf(r.id)}: بازگردانی شد (${r.created ? 'شرکت جدید ساخته شد، ' : ''}${fmtNum(r.inserted ?? 0)} رکورد وارد و ${fmtNum(r.deleted ?? 0)} رکورد قبلی جایگزین شد).`} />
              ) : (
                <Alert key={r.id} type="error" showIcon message={`${nameOf(r.id)}: بازگردانی نشد — ${r.error ?? ''}`} description={r.rolledBack ? 'اطلاعات قبلی این شرکت به حالت پیش از بازگردانی برگشت.' : 'اگر لازم شد، از پشتیبان خودکار بالا استفاده کنید.'} />
              ),
            )}
          </Space>
        </Card>
      ) : null}

      <Modal
        open={confirm}
        title="تأیید بازگردانی"
        okText="بازگردانی کن"
        cancelText="انصراف"
        okButtonProps={{ danger: true, disabled: word.trim() !== 'بازگردانی', loading: busy }}
        onOk={() => void run()}
        onCancel={() => (busy ? undefined : setConfirm(false))}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>اطلاعات فعلی این شرکت‌ها با فایل جایگزین می‌شود:</div>
          <ul style={{ margin: 0 }}>
            {sel.map((id) => (
              <li key={id}>{nameOf(id)}</li>
            ))}
          </ul>
          <div>برای ادامه، کلمهٔ <b>بازگردانی</b> را بنویسید:</div>
          <Input value={word} onChange={(e) => setWord(e.target.value)} />
        </Space>
      </Modal>
    </Space>
  );
}
