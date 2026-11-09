import { App, Alert, Button, Card, Select, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { downloadCsv, printTable } from '../../kit/exporter';
import type { ExportCol } from '../../kit/exporter';
import { fmtNum, str, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import { RecordDrawer } from '../../kit/RecordDrawer';
import type { FieldDef, Opt, Row } from '../../kit/types';
import { DateBox, SRC_NAME, accountOpts, num, useBankAccounts, useBankCall } from './common';

interface AccOptions {
  accounts: Array<{ AccID: string; Code: string; Name: string; IsActive?: boolean; Post?: boolean }>;
  employees: Array<{ id: string; Code: string; Name: string; IsActive?: boolean }>;
}

interface LedgerResult {
  account: { Name: string };
  rows: Row[];
  totals: { debit: number; credit: number; balance: number; status: string };
}

const on = (v: unknown) => v !== false && v !== 0 && v !== '0' && String(v).toLowerCase() !== 'false';

/** گردش یک بانک / صندوق / تنخواه‌گردان با ثبت دریافت و پرداخت متفرقه */
export function AccountLedger({ accountId, onBack }: { accountId: string; onBack?: () => void }) {
  const { company, data } = useCompany();
  const { message, modal, notification } = App.useApp();
  const call = useBankCall();
  const accs = useBankAccounts();
  const acc = useCsQuery<AccOptions>('accOptions', {});
  const [account, setAccount] = useState(accountId);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ account: accountId, from: '', to: '' });
  const q = useCsQuery<LedgerResult>('bankLedger', applied, !!applied.account);
  const r = q.data;
  const [form, setForm] = useState<{ dir: 'in' | 'out'; row: Row | null } | null>(null);
  const [saving, setSaving] = useState(false);

  const counterOpts = useMemo<Opt[]>(
    () => (acc.data?.accounts ?? []).filter((a) => on(a.IsActive) && on(a.Post)).map((a) => ({ value: a.AccID, label: `${a.Code} - ${a.Name}` })),
    [acc.data],
  );
  const partyOpts = useMemo<Opt[]>(() => {
    const out: Opt[] = [];
    const act = (x: Row) => x.CompanyID === company && on(x.IsActive);
    (data?.customers ?? []).filter(act).forEach((c) => out.push({ value: `customer:${str(c.CustomerID)}`, label: `خریدار: ${str(c.Name)}` }));
    (data?.suppliers ?? []).filter(act).forEach((c) => out.push({ value: `supplier:${str(c.SupplierID)}`, label: `فروشنده: ${str(c.Name)}` }));
    (acc.data?.employees ?? []).filter((e) => on(e.IsActive)).forEach((e) => out.push({ value: `employee:${e.id}`, label: `کارمند: ${e.Name}` }));
    return out;
  }, [data, acc.data, company]);

  const fields = useMemo<FieldDef[]>(
    () => [
      { name: 'DateJalali', label: 'تاریخ', type: 'date', required: true, span: 8 },
      { name: 'DocNo', label: 'شمارهٔ سند (خودکار)', span: 8 },
      { name: 'Amount', label: 'مبلغ (ریال)', type: 'money', required: true, span: 8 },
      { name: 'Ref', label: 'ارجاع / شمارهٔ پیگیری', span: 24 },
      { name: 'Description', label: 'شرح', required: true, span: 24 },
      { name: 'CounterAcc', label: 'حساب مقابل در سند حسابداری (اختیاری)', type: 'select', options: counterOpts, span: 12, help: form?.dir === 'in' ? 'پیش‌فرض: سایر درآمدهای غیرعملیاتی' : 'پیش‌فرض: هزینه‌های متفرقه' },
      { name: 'CounterParty', label: 'شخص مقابل (اختیاری)', type: 'select', options: partyOpts, span: 12 },
    ],
    [counterOpts, partyOpts, form?.dir],
  );
  const initial = useMemo<Row>(() => {
    const x = form?.row;
    return x
      ? { DateJalali: str(x.DateJalali), DocNo: str(x.DocNo), Amount: str(x.Debit || x.Credit), Ref: str(x.Ref), Description: str(x.Description), CounterAcc: x.CounterAcc || undefined, CounterParty: x.CounterParty || undefined }
      : { DateJalali: todayJalali() };
  }, [form]);

  const run = () => setApplied({ account, from, to });

  const submit = async (v: Row) => {
    if (!form) return;
    setSaving(true);
    try {
      await call('bankTxSave', {
        obj: {
          TxID: form.row ? str(form.row.TxID) : '',
          AccountID: applied.account,
          Dir: form.dir,
          DateJalali: str(v.DateJalali),
          DocNo: str(v.DocNo),
          Amount: str(v.Amount),
          Ref: str(v.Ref),
          Description: str(v.Description),
          CounterAcc: str(v.CounterAcc),
          CounterParty: str(v.CounterParty),
        },
      });
      message.success('ثبت شد.');
      setForm(null);
    } catch (e) {
      notification.error({ message: 'ثبت انجام نشد', description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const del = (x: Row) =>
    modal.confirm({
      title: 'حذف',
      content: 'این ردیف حذف شود؟',
      okText: 'حذف',
      okButtonProps: { danger: true },
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          await call('bankTxDelete', { id: str(x.TxID) });
          message.success('حذف شد.');
        } catch (e) {
          notification.error({ message: 'حذف انجام نشد', description: errorMessage(e) });
        }
      },
    });

  const rows = r?.rows ?? [];
  let counter = 0;
  const numbered = rows.map((x) => ({ ...x, _n: x.Kind === 'tx' ? ++counter : '' }));

  const cols: TableColumnsType<Row> = [
    { title: '#', key: 'n', width: 56, render: (_, x) => x._n },
    { title: 'تاریخ', key: 'd', render: (_, x) => str(x.DateJalali) },
    { title: 'شماره', key: 'no', render: (_, x) => str(x.DocNo) },
    {
      title: 'شرح',
      key: 'e',
      render: (_, x) => (
        <span>
          {str(x.Description)} {x.Kind === 'tx' && x.SrcType !== 'manual' && SRC_NAME[str(x.SrcType)] ? <Typography.Text type="secondary">[{SRC_NAME[str(x.SrcType)]}]</Typography.Text> : null}
        </span>
      ),
    },
    { title: 'بدهکار (دریافت)', key: 'db', render: (_, x) => (x.Debit ? fmtNum(x.Debit) : '') },
    { title: 'بستانکار (پرداخت)', key: 'cr', render: (_, x) => (x.Credit ? fmtNum(x.Credit) : '') },
    { title: 'تراز', key: 'b', render: (_, x) => fmtNum(Math.abs(num(x.Balance))) },
    { title: 'تشخیص', key: 's', render: (_, x) => <Typography.Text type={x.Status === 'بس' ? 'danger' : 'success'} strong>{str(x.Status)}</Typography.Text> },
    { title: 'ارجاع', key: 'rf', render: (_, x) => str(x.Ref) },
    {
      title: '',
      key: 'a',
      render: (_, x) =>
        x.Kind === 'tx' && x.SrcType === 'manual' ? (
          <Space size={4}>
            <Button size="small" onClick={() => setForm({ dir: x.Debit ? 'in' : 'out', row: x })}>ویرایش</Button>
            <Button size="small" danger onClick={() => del(x)}>حذف</Button>
          </Space>
        ) : x.Kind === 'tx' && x.SrcType === 'voucher' ? (
          <Tag>سند حسابداری</Tag>
        ) : null,
    },
  ];

  const exCols: ExportCol<Row>[] = [
    { title: '#', value: (x) => (x._n === '' ? '' : x._n) },
    { title: 'تاریخ', value: (x) => str(x.DateJalali) },
    { title: 'شماره', value: (x) => str(x.DocNo) },
    { title: 'شرح', value: (x) => str(x.Description) },
    { title: 'بدهکار (دریافت)', numeric: true, value: (x) => num(x.Debit) || '' },
    { title: 'بستانکار (پرداخت)', numeric: true, value: (x) => num(x.Credit) || '' },
    { title: 'تراز', numeric: true, value: (x) => (x._foot ? num(r?.totals.balance) : Math.abs(num(x.Balance))) },
    { title: 'تشخیص', value: (x) => str(x.Status) },
    { title: 'ارجاع', value: (x) => str(x.Ref) },
  ];
  const foot: Row | undefined = r ? { _n: '', Description: 'جمع', Debit: r.totals.debit, Credit: r.totals.credit, Balance: Math.abs(r.totals.balance), Status: r.totals.status, _foot: true } : undefined;
  const sub = `${applied.from || applied.to ? `از ${applied.from || 'ابتدا'} تا ${applied.to || 'انتها'}` : 'کل دوره'} | تاریخ تهیه: ${todayJalali()}`;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space wrap align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
            <Typography.Title level={3} style={{ margin: 0 }}>
              گردش حساب
            </Typography.Title>
            {onBack ? <Button onClick={onBack}>← بازگشت به فهرست</Button> : null}
          </Space>
          <Space wrap>
            <span>بانک / صندوق / تنخواه</span>
            <Select style={{ minWidth: 260 }} showSearch optionFilterProp="label" value={account || undefined} options={accountOpts(accs.data?.rows, undefined, account)} onChange={(v) => setAccount(v)} />
            <DateBox value={from} onChange={setFrom} placeholder="از تاریخ" />
            <DateBox value={to} onChange={setTo} placeholder="تا تاریخ" />
            <Button type="primary" onClick={run}>نمایش</Button>
          </Space>
          <Space wrap>
            <Button onClick={() => setForm({ dir: 'in', row: null })} disabled={!applied.account}>+ دریافت متفرقه</Button>
            <Button onClick={() => setForm({ dir: 'out', row: null })} disabled={!applied.account}>+ پرداخت متفرقه</Button>
            <Button disabled={!r} onClick={() => r && downloadCsv(`bank-ledger-${r.account.Name}-${todayJalali().replace(/\//g, '-')}`, exCols, numbered, foot)}>خروجی Excel (CSV)</Button>
            <Button
              disabled={!r}
              onClick={() => {
                if (r && !printTable(`گردش حساب: ${r.account.Name}`, sub, exCols, numbered, foot)) message.warning('مرورگر تب جدید را مسدود کرد.');
              }}
            >
              چاپ
            </Button>
          </Space>
        </Space>
      </Card>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      {r ? (
        <Space wrap size="large">
          <span>جمع دریافتی‌ها (ستون بدهکار): <b>{fmtNum(r.totals.debit)}</b></span>
          <span>جمع پرداختی‌ها (ستون بستانکار): <b>{fmtNum(r.totals.credit)}</b></span>
          <span>مانده (تراز): <b>{fmtNum(Math.abs(r.totals.balance))} {r.totals.status}</b></span>
        </Space>
      ) : null}
      <Card>
        <Table
          size="small"
          rowKey={(x, i) => `${str(x.TxID)}-${i}`}
          loading={q.isFetching}
          dataSource={numbered}
          columns={cols}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 100, hideOnSinglePage: true, showSizeChanger: false }}
          locale={{ emptyText: applied.account ? 'گردشی ثبت نشده است.' : 'یک حساب انتخاب کنید.' }}
          onRow={(x) => ({ style: x.Kind === 'tx' ? undefined : { fontWeight: 600, background: 'rgba(128,128,128,.08)' } })}
        />
        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          بدهکار = دریافتی‌ها؛ بستانکار = پرداختی‌ها؛ تراز = تفاضل آن‌ها. تشخیص: «بد» = مانده بدهکار، «بس» = مانده بستانکار.
        </Typography.Paragraph>
      </Card>
      <RecordDrawer
        open={!!form}
        title={form ? `${form.row ? 'ویرایش' : 'ثبت'} ${form.dir === 'in' ? 'دریافت' : 'پرداخت'} متفرقه — ${r?.account.Name ?? ''}` : ''}
        fields={fields}
        initial={initial}
        saving={saving}
        width={720}
        note="برای دریافت/پرداخت فاکتورها از «فاکتورهای فروش/هزینه/خرید»، برای جابه‌جایی بین حساب‌ها از «انتقال» استفاده کنید؛ این فرم فقط برای موارد متفرقه (مثل سود سپرده یا کارمزد) است."
        onClose={() => setForm(null)}
        onSubmit={submit}
      />
    </Space>
  );
}
