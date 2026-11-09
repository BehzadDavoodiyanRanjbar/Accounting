import { App, Alert, Button, Card, Input, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { downloadCsv } from '../../kit/exporter';
import type { ExportCol } from '../../kit/exporter';
import { str, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import { RecordDrawer } from '../../kit/RecordDrawer';
import type { FieldDef, Row } from '../../kit/types';
import { useBankCall } from '../bank/common';
import { AC_CATS, AC_D4, AC_LV, LEVEL_NAME, optsOf } from './common';

interface Acc {
  AccID: string;
  ParentID: string;
  Code: string;
  Name: string;
  Level: number;
  Cat?: string;
  Det4?: string;
  Det5?: string;
  Det6?: string;
  Post?: boolean;
  ReqDate?: boolean;
  ReqTxt?: boolean;
  ReqNum?: boolean;
  IsActive: boolean;
  IsSystem?: boolean;
  Used?: number;
  Notes?: string;
}
interface Node extends Acc {
  children?: Node[];
}

const norm = (s: string) => s.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').toLowerCase();
const levelColor = ['', 'inherit', '#0a6cff', '#c11574'];

/** جدول حساب‌ها (گروه ← کل ← معین) */
export default function ChartPage() {
  const { message, modal, notification } = App.useApp();
  const call = useBankCall();
  const q = useCsQuery<{ rows: Acc[] }>('accTree', {});
  const all = useMemo(() => q.data?.rows ?? [], [q.data]);
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [form, setForm] = useState<{ row: Acc | null; parent: Acc | null; level: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const tree = useMemo<Node[]>(() => {
    const kids: Record<string, Node[]> = {};
    all.forEach((a) => {
      (kids[a.ParentID || ''] = kids[a.ParentID || ''] || []).push({ ...a });
    });
    const q2 = norm(search.trim());
    const byId: Record<string, Acc> = {};
    all.forEach((a) => (byId[a.AccID] = a));
    const keep = new Set<string>();
    if (q2) {
      all.forEach((a) => {
        if (norm(`${a.Code} ${a.Name}`).includes(q2)) {
          let x: Acc | undefined = a;
          while (x) {
            keep.add(x.AccID);
            x = x.ParentID ? byId[x.ParentID] : undefined;
          }
        }
      });
    }
    const build = (pid: string): Node[] =>
      (kids[pid] ?? [])
        .filter((a) => !q2 || keep.has(a.AccID))
        .map((a) => {
          const c = build(a.AccID);
          return c.length ? { ...a, children: c } : { ...a };
        });
    return build('');
  }, [all, search]);

  const allIds = useMemo(() => all.filter((a) => all.some((b) => b.ParentID === a.AccID)).map((a) => a.AccID), [all]);
  const selRec = all.find((a) => a.AccID === sel) ?? null;

  const cols: TableColumnsType<Node> = [
    { title: 'کد', key: 'c', width: 110, render: (_, a) => a.Code },
    {
      title: 'حساب',
      key: 'n',
      render: (_, a) => (
        <span style={{ color: levelColor[a.Level], fontWeight: a.Level < 3 ? 700 : 400 }}>
          {a.Name} {a.IsSystem ? '🔒' : ''}
        </span>
      ),
    },
    { title: 'تفصیلی', key: 'd4', render: (_, a) => (a.Level === 3 ? (a.Det4 ? AC_D4[a.Det4] : <Typography.Text type="secondary">حساب</Typography.Text>) : '') },
    { title: 'شخص / مرکز هزینه', key: 'd5', render: (_, a) => (a.Level === 3 && a.Det5 ? AC_LV[a.Det5] : '') },
    { title: 'پروژه', key: 'd6', render: (_, a) => (a.Level === 3 && a.Det6 ? AC_LV[a.Det6] : '') },
    { title: 'نوع', key: 'cat', render: (_, a) => a.Cat ?? '' },
    {
      title: 'وضعیت',
      key: 's',
      render: (_, a) => (
        <Space size={4} wrap>
          {a.IsActive ? null : <Tag color="red">غیرفعال</Tag>}
          {a.Level === 3 && !a.Post ? <Tag>بدون ثبت سند</Tag> : null}
          {a.Level === 3 && (a.ReqDate || a.ReqTxt || a.ReqNum) ? <Tag color="blue">عطف اجباری: {[a.ReqDate ? 'تاریخ' : '', a.ReqTxt ? 'حرفی' : '', a.ReqNum ? 'عددی' : ''].filter(Boolean).join('، ')}</Tag> : null}
          {a.Used ? <Typography.Text type="secondary">{a.Used} ردیف سند</Typography.Text> : null}
        </Space>
      ),
    },
  ];

  const openForm = (row: Acc | null, parent: Acc | null) => {
    const level = row ? row.Level : parent ? parent.Level + 1 : 1;
    setForm({ row, parent, level });
  };

  const fields = useMemo<FieldDef[]>(() => {
    if (!form) return [];
    const sys = !!form.row?.IsSystem;
    const lv = form.level;
    const f: FieldDef[] = [
      { name: 'Code', label: `کد${form.row ? '' : ' (خودکار)'}`, span: 8, placeholder: 'خودکار', disabled: sys },
      { name: 'Name', label: 'نام', required: true, span: 16 },
    ];
    if (lv === 1) f.push({ name: 'Cat', label: 'نوع گروه', type: 'select', required: true, options: AC_CATS.map((x) => ({ value: x, label: x })), span: 12 });
    if (lv === 3) {
      f.push({ name: 'Det4', label: 'تفصیلی (سطح ۴)', type: 'select', options: optsOf(AC_D4), span: 8, disabled: sys });
      f.push({ name: 'Det5', label: 'شخص / مرکز هزینه (سطح ۵)', type: 'select', options: optsOf(AC_LV), span: 8 });
      f.push({ name: 'Det6', label: 'پروژه (سطح ۶)', type: 'select', options: optsOf(AC_LV), span: 8 });
    }
    f.push({ name: 'Notes', label: 'توضیحات', span: 24 });
    if (lv === 3) {
      f.push({ name: 'Post', label: 'اجازهٔ ثبت سند', type: 'check', span: 6 });
      f.push({ name: 'ReqDate', label: 'تاریخ عطف (اجباری)', type: 'check', span: 6 });
      f.push({ name: 'ReqTxt', label: 'عطف حرفی (اجباری)', type: 'check', span: 6 });
      f.push({ name: 'ReqNum', label: 'عطف عددی (اجباری)', type: 'check', span: 6 });
    }
    f.push({ name: 'IsActive', label: 'فعال', type: 'check', span: 6, disabled: sys });
    return f;
  }, [form]);

  const initial = useMemo<Row>(() => {
    if (!form) return {};
    const o = form.row;
    if (o) {
      return { Code: str(o.Code), Name: str(o.Name), Cat: o.Cat, Det4: o.Det4 || undefined, Det5: o.Det5 || undefined, Det6: o.Det6 || undefined, Notes: str(o.Notes), Post: o.Post !== false, ReqDate: !!o.ReqDate, ReqTxt: !!o.ReqTxt, ReqNum: !!o.ReqNum, IsActive: o.IsActive !== false };
    }
    return { Cat: form.parent?.Cat ?? 'دارایی', Post: true, IsActive: true };
  }, [form]);

  const submit = async (v: Row) => {
    if (!form) return;
    setSaving(true);
    try {
      const o: Row = { AccID: form.row ? form.row.AccID : '', ParentID: form.parent ? form.parent.AccID : '', Code: str(v.Code), Name: str(v.Name), Notes: str(v.Notes), IsActive: v.IsActive !== false };
      if (form.level === 1) o.Cat = str(v.Cat);
      if (form.level === 3) {
        o.Det4 = str(v.Det4);
        o.Det5 = str(v.Det5);
        o.Det6 = str(v.Det6);
        o.Post = !!v.Post;
        o.ReqDate = !!v.ReqDate;
        o.ReqTxt = !!v.ReqTxt;
        o.ReqNum = !!v.ReqNum;
      }
      const r = await call('accSave', { obj: o });
      message.success(`ذخیره شد (کد ${str(r.Code)}).`);
      if (form.parent) setExpanded((e) => [...new Set([...e, form.parent!.AccID])]);
      setSel(str(r.AccID));
      setForm(null);
    } catch (e) {
      notification.error({ message: 'ذخیره انجام نشد', description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const del = () => {
    if (!selRec) return void message.info('ابتدا یک حساب را انتخاب کنید.');
    modal.confirm({
      title: 'حذف حساب',
      content: `حساب «${selRec.Code} - ${selRec.Name}» حذف شود؟`,
      okText: 'حذف',
      okButtonProps: { danger: true },
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          await call('accDelete', { id: selRec.AccID });
          message.success('حذف شد.');
          setSel('');
        } catch (e) {
          notification.error({ message: 'حذف انجام نشد', description: errorMessage(e) });
        }
      },
    });
  };

  const reseed = () =>
    modal.confirm({
      title: 'افزودن حساب‌های استاندارد',
      content: 'حساب‌های استاندارد که در جدول شما نیستند افزوده شوند؟ (حساب‌های موجود تغییری نمی‌کنند)',
      okText: 'افزودن',
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          const r = await call('accReseed', {});
          message.success(r.added ? `${str(r.added)} حساب افزوده شد.` : 'همهٔ حساب‌های استاندارد موجود است.');
        } catch (e) {
          notification.error({ message: 'انجام نشد', description: errorMessage(e) });
        }
      },
    });

  const exCols: ExportCol<Acc>[] = [
    { title: 'کد', value: (a) => a.Code },
    { title: 'سطح', value: (a) => LEVEL_NAME[a.Level] ?? '' },
    { title: 'نام حساب', value: (a) => `${a.Level > 1 ? '    ' : ''}${a.Level > 2 ? '    ' : ''}${a.Name}` },
    { title: 'تفصیلی', value: (a) => (a.Level === 3 ? (a.Det4 ? AC_D4[a.Det4] : 'حساب') : '') },
    { title: 'شخص / مرکز هزینه', value: (a) => (a.Level === 3 ? AC_LV[a.Det5 ?? ''] : '') },
    { title: 'پروژه', value: (a) => (a.Level === 3 ? AC_LV[a.Det6 ?? ''] : '') },
    { title: 'نوع', value: (a) => a.Cat ?? '' },
    { title: 'سیستمی', value: (a) => (a.IsSystem ? 'بله' : '') },
    { title: 'وضعیت', value: (a) => (a.IsActive ? 'فعال' : 'غیرفعال') },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            جدول حساب‌ها
          </Typography.Title>
          <Space wrap>
            <Input style={{ width: 240 }} placeholder="جستجو (کد یا نام)" value={search} onChange={(e) => setSearch(e.target.value)} allowClear />
            <Button type="primary" onClick={() => openForm(null, null)}>+ گروه جدید</Button>
            <Button
              onClick={() => {
                if (!selRec) return void message.info('ابتدا حساب مرجع را در جدول انتخاب کنید (یا «گروه جدید» بزنید).');
                if (selRec.Level >= 3) return void message.info('زیر «معین» حساب ساخته نمی‌شود؛ از تفصیلی، شخص یا پروژه استفاده کنید.');
                openForm(null, selRec);
              }}
            >
              + زیرمجموعه
            </Button>
            <Button onClick={() => (selRec ? openForm(selRec, null) : message.info('ابتدا یک حساب را انتخاب کنید.'))}>ویرایش</Button>
            <Button danger onClick={del}>حذف</Button>
            <Button onClick={() => setExpanded((e) => (e.length ? [] : allIds))}>باز/بستن همه</Button>
            <Button onClick={reseed}>افزودن حساب‌های استاندارد گم‌شده</Button>
            <Button onClick={() => downloadCsv(`chart-of-accounts-${todayJalali().replace(/\//g, '-')}`, exCols, all)}>خروجی Excel (CSV)</Button>
          </Space>
          <Typography.Text type="secondary">سطح ۱ گروه، ۲ کل، ۳ معین (سند فقط روی «معین» ثبت می‌شود). تفصیلی، شخص / مرکز هزینه و پروژه در هر ردیف سند انتخاب می‌شوند. 🔒 = حساب سیستمی (برای اسناد خودکار)؛ حذف نمی‌شود. برای انتخاب یک حساب روی ردیف آن کلیک کنید.</Typography.Text>
        </Space>
      </Card>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      <Card>
        <Table<Node>
          size="small"
          rowKey="AccID"
          loading={q.isFetching}
          columns={cols}
          dataSource={tree}
          pagination={false}
          scroll={{ x: 'max-content' }}
          expandable={{
            expandedRowKeys: search.trim() ? allIds : expanded,
            onExpandedRowsChange: (keys) => setExpanded(keys.map(String)),
          }}
          rowClassName={(a) => (a.AccID === sel ? 'ant-table-row-selected' : '')}
          onRow={(a) => ({
            onClick: () => setSel((s) => (s === a.AccID ? '' : a.AccID)),
            style: { cursor: 'pointer', opacity: a.IsActive ? 1 : 0.55 },
          })}
          locale={{ emptyText: 'حسابی نیست.' }}
        />
      </Card>
      <RecordDrawer
        open={!!form}
        title={form ? `${form.row ? 'ویرایش حساب' : 'حساب جدید'} — سطح ${form.level} (${LEVEL_NAME[form.level]})${form.parent ? ` — اضافه به: ${form.parent.Code} - ${form.parent.Name}` : ''}` : ''}
        fields={fields}
        initial={initial}
        saving={saving}
        width={820}
        note={form?.level === 3 ? '«تفصیلی»: در سند، برای این حساب از همان فهرست انتخاب می‌شود (مثلاً بانک). «شخص / مرکز هزینه»: خریدار، فروشنده یا کارمند. «الزامی» یعنی بدون انتخاب آن، سند تأیید نمی‌شود. تیک‌های «اجباری در سند»: در ثبت دستی پر کردن آن‌ها الزامی است و در سندهای خودکار از روی سند مبدأ پر می‌شوند.' : undefined}
        onClose={() => setForm(null)}
        onSubmit={submit}
      />
    </Space>
  );
}
