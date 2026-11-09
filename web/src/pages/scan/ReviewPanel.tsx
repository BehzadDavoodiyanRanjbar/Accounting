import { App, Alert, Button, Checkbox, Col, Collapse, Drawer, Input, Row, Select, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { callApi, errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { fmtNum, todayJalali } from '../../kit/format';
import { NumInput } from '../../kit/NumInput';
import { accountOpts } from '../bank/common';
import type { BankAcc } from '../bank/common';
import { FIELD_LABEL, KIND_FIELDS, KIND_TITLE, guessMapping, newPayRow, newPayrollRow, paymentsFromGrid, payrollFromGrid } from './extract';
import type { FieldKey, Mapping } from './extract';
import { isValidIban, isValidNationalCode, matchPerson, parseJalaliDate, parsePeriod } from './normalize';
import type { Unit } from './normalize';
import { CONF_BAD, CONF_WARN, ROLE_LABEL, buildInsuranceVoucher, buildPaymentsVoucher, buildPayrollVoucher, canCreate, employerShare, insuranceIssues, matchPayRows, payrollIssues, payrollPayables, payrollTotals, paymentsIssues, rowDiff } from './rules';
import type { AccRole, Draft, InsuranceDoc, Issue, Line, PayRow, PayrollRow } from './rules';
import type { DocInit, QItem } from './types';

const { Text } = Typography;

const UNIT_OPTS: Array<{ value: Unit; label: string }> = [
  { value: 'rial', label: 'ریال' },
  { value: 'toman', label: 'تومان' },
  { value: 'unknown', label: 'نامشخص — انتخاب کنید' },
];
const rowBg = (conf: number, confirmed: boolean): string | undefined => (confirmed || conf >= CONF_WARN ? undefined : conf < CONF_BAD ? '#fff1f0' : '#fffbe6');
const confTag = (conf: number, confirmed: boolean) => (confirmed || conf >= CONF_WARN ? <Tag color="green">{Math.round(conf * 100)}٪</Tag> : <Tag color={conf < CONF_BAD ? 'red' : 'gold'}>{Math.round(conf * 100)}٪</Tag>);

interface Props {
  item: QItem;
  init: DocInit;
  banks: BankAcc[];
  accName: (id: string) => string;
  onPatch: (fn: (q: QItem) => QItem) => void;
  onClose: () => void;
  onCreated: () => void;
}

/** پنل بررسی: پیش‌نمایش سند، جدول قابل‌ویرایش، اعتبارسنجی و پیش‌نمایش سند حسابداری. تمام محاسبه‌های مالی را توابع خالص rules.ts انجام می‌دهند. */
export function ReviewPanel({ item, init, banks, accName, onPatch, onClose, onCreated }: Props) {
  const { company } = useCompany();
  const { message } = App.useApp();
  const nav = useNavigate();
  const rates = init.settings.rates;
  const [date, setDate] = useState(() => (item.insurance?.date && parseJalaliDate(item.insurance.date)?.j) || todayJalali());
  const [bankId, setBankId] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [dupTrack, setDupTrack] = useState<Array<{ no: string; where: string }>>([]);
  const [zoom, setZoom] = useState(1);

  const people = useMemo(() => init.employees.map((e) => ({ key: e.key, name: e.name, nationalCode: e.nationalCode })), [init.employees]);
  const kind = item.kind;

  /* ----- محاسبات (توابع خالص) ----- */
  const view = useMemo(() => {
    if (kind === 'payroll' && item.payroll) {
      const d = item.payroll;
      return { draft: buildPayrollVoucher(d, rates), issues: payrollIssues(d, rates), extra: null as null | { diff: number | null } };
    }
    if (kind === 'payment' && item.payments) {
      const d = item.payments;
      const r = buildPaymentsVoucher(d, init.employees.map((e) => ({ key: e.key, name: e.name, nationalCode: e.nationalCode, open: e.open })));
      return { draft: r.draft, issues: paymentsIssues(d, r), extra: null };
    }
    if (kind === 'insurance' && item.insurance) {
      const d = item.insurance;
      const period = parsePeriod(d.periodMonth) ?? '';
      const open = period && period in init.insuranceOpen ? Math.max(0, init.insuranceOpen[period]) : null;
      const r = buildInsuranceVoucher(d, open);
      return { draft: r.draft, issues: insuranceIssues(d, r), extra: { diff: r.diff } };
    }
    return { draft: { lines: [], totalDebit: 0, totalCredit: 0, balanced: false } as Draft, issues: [] as Issue[], extra: null };
  }, [kind, item.payroll, item.payments, item.insurance, init.employees, init.insuranceOpen, rates]);

  const trackingNos = useMemo(() => (kind === 'payment' ? (item.payments?.rows ?? []).map((r) => r.trackingNo) : kind === 'insurance' ? [item.insurance?.trackingNo ?? ''] : []), [kind, item.payments, item.insurance]);
  useEffect(() => {
    const t = trackingNos.map((x) => x.trim()).filter(Boolean);
    if (!t.length) return setDupTrack([]);
    let off = false;
    callApi<{ dupTrack: Array<{ no: string; where: string }> }>('docCheck', { company, hash: item.hash, trackingNos: t })
      .then((r) => !off && setDupTrack(r.dupTrack))
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, [company, item.hash, trackingNos]);

  const extraIssues: Issue[] = [];
  const needRoles: AccRole[] = [...new Set(view.draft.lines.map((l) => l.role))].filter((r) => r !== 'bank');
  needRoles.forEach((r) => {
    if (!init.settings.acc[r]) extraIssues.push({ code: 'bank', severity: 'block', message: `حساب «${ROLE_LABEL[r]}» در «تنظیمات» مشخص نشده است.` });
  });
  if (kind !== 'payroll' && !bankId) extraIssues.push({ code: 'bank', severity: 'block', message: 'حساب بانک/صندوق پرداخت را انتخاب کنید.' });
  const vDate = parseJalaliDate(date);
  if (!vDate) extraIssues.push({ code: 'date', severity: 'block', message: 'تاریخ سند نامعتبر است (قالب: 1405/08/16).' });
  if (item.status === 'duplicate') extraIssues.push({ code: 'dup', severity: 'block', message: item.dupInfo || 'این فایل قبلاً ثبت شده است.' });
  if (item.status === 'confirmed') extraIssues.push({ code: 'dup', severity: 'block', message: 'این سند قبلاً به پیش‌نویس تبدیل شده است.' });
  dupTrack.forEach((d) => extraIssues.push({ code: 'dup', severity: 'warn', message: `شمارهٔ پیگیری ${d.no} قبلاً ثبت شده است: ${d.where}.` }));
  const issues = [...view.issues, ...extraIssues];
  const ok = canCreate(view.draft, issues) && !busy;

  /* ----- ویرایش با ثبت اصلاحات ----- */
  const logTxt = (what: string, from: unknown, to: unknown) => `${what}: «${String(from)}» ← «${String(to)}»`;
  const patchPayroll = (id: number, p: Partial<PayrollRow>, what: string, from: unknown, to: unknown) =>
    onPatch((q) => (q.payroll ? { ...q, payroll: { ...q.payroll, rows: q.payroll.rows.map((r) => (r.id === id ? { ...r, ...p, confirmed: true } : r)) }, corrections: [...q.corrections, logTxt(what, from, to)].slice(-300) } : q));
  const patchPay = (id: number, p: Partial<PayRow>, what: string, from: unknown, to: unknown, rematch = true) =>
    onPatch((q) => {
      if (!q.payments) return q;
      const rows = q.payments.rows.map((r) => (r.id === id ? { ...r, ...p, confirmed: true } : r));
      return { ...q, payments: { ...q.payments, rows: rematch ? matchPayRows(rows, people) : rows }, corrections: [...q.corrections, logTxt(what, from, to)].slice(-300) };
    });
  const patchIns = (p: Partial<InsuranceDoc>, what: string, from: unknown, to: unknown) =>
    onPatch((q) => (q.insurance ? { ...q, insurance: { ...q.insurance, ...p, confirmed: true }, corrections: [...q.corrections, logTxt(what, from, to)].slice(-300) } : q));
  const setUnit = (u: Unit) =>
    onPatch((q) => ({ ...q, payroll: q.payroll ? { ...q.payroll, unit: u } : q.payroll, payments: q.payments ? { ...q.payments, unit: u } : q.payments, insurance: q.insurance ? { ...q.insurance, unit: u } : q.insurance, corrections: [...q.corrections, `واحد مبلغ: ${u}`] }));

  /* ----- نگاشت ستون‌های Excel/CSV ----- */
  const sheet = item.sheets?.[item.sheetIdx ?? 0];
  const mapping = item.mapping;
  const rebuild = (sheetIdx: number, m: Mapping) =>
    onPatch((q) => {
      const rows = q.sheets?.[sheetIdx]?.rows ?? [];
      if (q.kind === 'payroll') {
        const r = payrollFromGrid(rows, m);
        const cap = q.ocrCap ?? 1;
        return { ...q, sheetIdx, mapping: m, src: r.src, payroll: { ...r.doc, rows: r.doc.rows.map((x) => ({ ...x, conf: Math.min(x.conf, cap) })), unit: q.payroll?.unit ?? 'unknown', period: q.payroll?.period ?? '' } };
      }
      const r = paymentsFromGrid(rows, m);
      const cap = q.ocrCap ?? 1;
      return { ...q, sheetIdx, mapping: m, src: r.src, payments: { ...r.doc, unit: q.payments?.unit ?? 'unknown', rows: matchPayRows(r.doc.rows.map((x) => ({ ...x, conf: Math.min(x.conf, cap) })), people) } };
    });

  const create = async () => {
    if (!vDate) return;
    setBusy(true);
    try {
      const lines = view.draft.lines.map((l) => ({ role: l.role, debit: l.debit, credit: l.credit, description: l.description, person: l.person }));
      let payload: Record<string, unknown> = {};
      let periodKey = '';
      let track: string[] = [];
      let unit: Unit = 'rial';
      if (kind === 'payroll' && item.payroll) {
        const pp = payrollPayables(item.payroll, rates);
        payload = { employees: pp.employees, insurance: pp.insurance };
        periodKey = item.payroll.period;
        unit = item.payroll.unit;
      } else if (kind === 'payment' && item.payments) {
        const r = buildPaymentsVoucher(item.payments, init.employees.map((e) => ({ key: e.key, name: e.name, nationalCode: e.nationalCode, open: e.open })));
        payload = { items: r.items.map((i) => ({ key: i.personKey, name: i.name, applied: i.applied, excess: i.excess, trackingNo: item.payments?.rows.find((x) => x.id === i.rowId)?.trackingNo ?? '' })) };
        track = item.payments.rows.map((x) => x.trackingNo);
        unit = item.payments.unit;
      } else if (item.insurance) {
        const r = buildInsuranceVoucher(item.insurance, null);
        payload = { principal: r.principal };
        periodKey = parsePeriod(item.insurance.periodMonth) ?? '';
        track = [item.insurance.trackingNo];
        unit = item.insurance.unit;
      }
      const res = await callApi<{ VID: string; No: string; createdEmployees: string[] }>('docCommit', {
        company, kind, hash: item.hash, fileName: item.fileName, date: vDate.j, periodKey, unit: unit === 'toman' ? 'toman' : 'rial',
        description: desc || `${KIND_TITLE[kind]}${periodKey ? ` ${periodKey}` : ''}`, lines, payload, bankAccId: bankId, trackingNos: track, corrections: item.corrections, extracted: item.extracted,
      });
      onPatch((q) => ({ ...q, status: 'confirmed', voucherNo: res.No }));
      message.success(
        <span>
          پیش‌نویس سند شماره {res.No} ساخته شد.{res.createdEmployees.length ? ` کارکنان جدید: ${res.createdEmployees.join('، ')}.` : ''}{' '}
          <a onClick={() => nav('/p/ac_list')}>مشاهدهٔ لیست اسناد (ستون پیش‌نویس)</a>
        </span>,
        8,
      );
      onCreated();
    } catch (e) {
      message.error(errorMessage(e), 8);
    } finally {
      setBusy(false);
    }
  };

  /* ----- جدول‌ها ----- */
  const payrollCols: TableColumnsType<PayrollRow> = [
    { title: '#', width: 40, render: (_v, _r, i) => i + 1 },
    { title: 'نام', width: 170, render: (_v, r) => <Input value={r.name} status={r.name.trim() ? undefined : 'error'} onChange={(e) => patchPayroll(r.id, { name: e.target.value }, 'نام', r.name, e.target.value)} /> },
    {
      title: 'کد ملی', width: 130,
      render: (_v, r) => (
        <Space direction="vertical" size={0}>
          <Input value={r.nationalCode} onChange={(e) => patchPayroll(r.id, { nationalCode: e.target.value }, 'کد ملی', r.nationalCode, e.target.value)} />
          {r.nationalCode && !isValidNationalCode(r.nationalCode) ? <Tag color="red">نامعتبر</Tag> : null}
        </Space>
      ),
    },
    ...([['gross', 'ناخالص'], ['employeeInsurance', 'بیمه کارمند'], ['incomeTax', 'مالیات'], ['otherDeductions', 'سایر کسور'], ['net', 'خالص پرداختنی']] as const).map(([k, t]) => ({
      title: t, width: 130,
      render: (_v: unknown, r: PayrollRow) => <NumInput value={r[k]} status={(r[k] as number) < 0 ? 'error' : undefined} onChange={(v) => patchPayroll(r.id, ({ [k]: Number(v) || 0 } as Partial<PayrollRow>), `${t} (ردیف)`, r[k], Number(v) || 0)} />,
    })),
    { title: 'مشمول بیمه', width: 130, render: (_v, r) => <NumInput value={r.grossInsurable ?? ''} placeholder="= ناخالص" onChange={(v) => patchPayroll(r.id, { grossInsurable: v === '' ? null : Number(v) || 0 }, 'مشمول بیمه', r.grossInsurable, v)} /> },
    { title: 'اختلاف', width: 100, render: (_v, r) => (rowDiff(r) !== 0 ? <Tag color="red">اختلاف {fmtNum(rowDiff(r))}</Tag> : <Tag color="green">صحیح</Tag>) },
    {
      title: 'کارمند', width: 190,
      render: (_v, r) => {
        const sug = r.personKey ? null : matchPerson({ name: r.name, nationalCode: r.nationalCode }, people);
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Select style={{ width: '100%' }} allowClear placeholder="کارمند جدید ساخته می‌شود" showSearch optionFilterProp="label" value={r.personKey || undefined} options={init.employees.map((e) => ({ value: e.key, label: e.name }))} onChange={(v) => patchPayroll(r.id, { personKey: v ?? '' }, 'کارمند', r.personKey, v ?? '')} />
            {sug ? <Tag color="orange" style={{ cursor: 'pointer' }} onClick={() => patchPayroll(r.id, { personKey: sug.person.key }, 'کارمند', '', sug.person.key)}>شبیه «{sug.person.name}» — انتخاب</Tag> : null}
          </Space>
        );
      },
    },
    { title: 'اطمینان', width: 80, render: (_v, r) => confTag(r.conf, r.confirmed) },
    { title: 'بررسی شد', width: 80, render: (_v, r) => <Checkbox checked={r.confirmed} onChange={(e) => onPatch((q) => (q.payroll ? { ...q, payroll: { ...q.payroll, rows: q.payroll.rows.map((x) => (x.id === r.id ? { ...x, confirmed: e.target.checked } : x)) } } : q))} /> },
    { title: '', width: 40, render: (_v, r) => <Button type="text" danger onClick={() => onPatch((q) => (q.payroll ? { ...q, payroll: { ...q.payroll, rows: q.payroll.rows.filter((x) => x.id !== r.id) }, corrections: [...q.corrections, `حذف ردیف ${r.name}`] } : q))}>✕</Button> },
  ];

  const payments = item.payments;
  const payRes = useMemo(() => (payments ? buildPaymentsVoucher(payments, init.employees.map((e) => ({ key: e.key, name: e.name, nationalCode: e.nationalCode, open: e.open }))) : null), [payments, init.employees]);
  const payCols: TableColumnsType<PayRow> = [
    { title: '#', width: 40, render: (_v, _r, i) => i + 1 },
    { title: 'نام', width: 160, render: (_v, r) => <Input value={r.payeeName} onChange={(e) => patchPay(r.id, { payeeName: e.target.value, how: r.how === 'manual' ? 'manual' : null }, 'نام', r.payeeName, e.target.value)} /> },
    {
      title: 'شبا', width: 200,
      render: (_v, r) => (
        <Space direction="vertical" size={0}>
          <Input value={r.iban} onChange={(e) => patchPay(r.id, { iban: e.target.value }, 'شبا', r.iban, e.target.value)} />
          {r.iban && !isValidIban(r.iban) ? <Tag color="red">نامعتبر</Tag> : null}
        </Space>
      ),
    },
    { title: 'مبلغ', width: 140, render: (_v, r) => <NumInput value={r.amount} onChange={(v) => patchPay(r.id, { amount: Number(v) || 0 }, 'مبلغ', r.amount, Number(v) || 0, false)} /> },
    { title: 'تاریخ', width: 110, render: (_v, r) => <Input value={r.date} status={r.date && !parseJalaliDate(r.date) ? 'error' : undefined} onChange={(e) => patchPay(r.id, { date: e.target.value }, 'تاریخ', r.date, e.target.value, false)} /> },
    { title: 'پیگیری', width: 120, render: (_v, r) => <Input value={r.trackingNo} onChange={(e) => patchPay(r.id, { trackingNo: e.target.value }, 'پیگیری', r.trackingNo, e.target.value, false)} /> },
    {
      title: 'تطبیق با کارمند', width: 230,
      render: (_v, r) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Select style={{ width: '100%' }} allowClear showSearch optionFilterProp="label" placeholder="نیازمند تطبیق دستی" value={r.personKey || undefined} options={init.employees.map((e) => ({ value: e.key, label: `${e.name} (بدهی باز ${fmtNum(e.open)})` }))} onChange={(v) => patchPay(r.id, v ? { personKey: v, how: 'manual', matchConfirmed: true } : { personKey: '', how: null, matchConfirmed: false }, 'تطبیق', r.personKey, v ?? '', false)} />
          {r.how === 'fuzzy' && !r.matchConfirmed ? <Button size="small" type="primary" ghost onClick={() => patchPay(r.id, { matchConfirmed: true }, 'تأیید تطبیق تقریبی', '', r.personKey, false)}>تطبیق تقریبی — تأیید می‌کنم</Button> : null}
          {r.how && r.how !== 'fuzzy' ? <Tag color="green">{r.how === 'manual' ? 'دستی' : 'تطبیق دقیق'}</Tag> : null}
          {r.how === 'fuzzy' && r.matchConfirmed ? <Tag color="blue">تقریبی (تأییدشده)</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'وضعیت', width: 150,
      render: (_v, r) => {
        const it = payRes?.items.find((x) => x.rowId === r.id);
        if (!it) return <Tag color="orange">نیازمند تطبیق دستی</Tag>;
        return it.overpaid ? <Tag color="red">پرداخت اضافه {fmtNum(it.excess)}</Tag> : <Tag color="green">تسویه {fmtNum(it.applied)}</Tag>;
      },
    },
    { title: 'اطمینان', width: 80, render: (_v, r) => confTag(r.conf, r.confirmed) },
    { title: 'بررسی شد', width: 80, render: (_v, r) => <Checkbox checked={r.confirmed} onChange={(e) => onPatch((q) => (q.payments ? { ...q, payments: { ...q.payments, rows: q.payments.rows.map((x) => (x.id === r.id ? { ...x, confirmed: e.target.checked } : x)) } } : q))} /> },
    { title: '', width: 40, render: (_v, r) => <Button type="text" danger onClick={() => onPatch((q) => (q.payments ? { ...q, payments: { ...q.payments, rows: q.payments.rows.filter((x) => x.id !== r.id) }, corrections: [...q.corrections, `حذف ردیف ${r.payeeName}`] } : q))}>✕</Button> },
  ];

  const ins = item.insurance;
  const field = (label: string, node: ReactNode) => (
    <Col xs={24} md={12} lg={8}>
      <div style={{ marginBottom: 4 }}>{label}</div>
      {node}
    </Col>
  );

  const sheetTable = sheet ? (
    <div style={{ overflow: 'auto', maxHeight: '70vh', border: '1px solid #d9d9d9' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
        <tbody>
          {sheet.rows.slice(0, 60).map((r, i) => (
            <tr key={i} style={{ background: mapping && i === mapping.headerRow ? '#e6f4ff' : undefined }}>
              <td style={{ border: '1px solid #eee', padding: '2px 6px', color: '#999' }}>{i + 1}</td>
              {r.slice(0, 14).map((c, j) => (
                <td key={j} style={{ border: '1px solid #eee', padding: '2px 6px', whiteSpace: 'nowrap' }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : null;
  const imgs = item.pages?.length ? item.pages.map((p) => p.imageUrl).filter(Boolean) : item.url && item.mime.startsWith('image/') ? [item.url] : [];
  const zoomBar = (
    <Space style={{ marginBottom: 8 }}>
      <Button size="small" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>+</Button>
      <Button size="small" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>−</Button>
      <Button size="small" onClick={() => setZoom(1)}>۱۰۰٪</Button>
    </Space>
  );
  const ocrInfo = item.pages?.length ? (
    <Alert
      style={{ marginBottom: 8 }}
      type={item.warnings?.length ? 'warning' : 'info'}
      showIcon
      message={`خوانده‌شده با ${item.pages.every((p) => p.origin === 'pdf-text') ? 'لایهٔ متنی PDF' : 'OCR داخلی'} · ${item.pages.length} صفحه · اطمینان کلی ${Math.round((item.pages.reduce((a, p) => a + p.conf, 0) / item.pages.length) * 100)}٪`}
      description={item.warnings?.length ? <div>{item.warnings.map((w) => <div key={w}>{w}</div>)}</div> : 'OCR فارسی خطا دارد؛ همهٔ اعداد را با تصویر مقایسه و ردیف‌ها را تأیید کنید.'}
    />
  ) : null;

  const preview = (
    <div>
      {ocrInfo}
      {imgs.length ? (
        <>
          {zoomBar}
          <div style={{ overflow: 'auto', maxHeight: '70vh', border: '1px solid #d9d9d9' }}>
            {imgs.map((u, i) => (
              <img key={u} src={u} alt={`پیش‌نمایش سند — صفحه ${i + 1}`} style={{ width: `${zoom * 100}%`, display: 'block', marginBottom: 4 }} />
            ))}
          </div>
          {sheetTable || item.ocrText ? (
            <Collapse
              style={{ marginTop: 8 }}
              size="small"
              items={[
                ...(sheetTable ? [{ key: 'grid', label: 'جدول تشخیص‌داده‌شده از تصویر', children: sheetTable }] : []),
                ...(item.ocrText ? [{ key: 'txt', label: 'متن خام خوانده‌شده', children: <pre style={{ whiteSpace: 'pre-wrap', margin: 0, maxHeight: '40vh', overflow: 'auto', direction: 'rtl' }}>{item.ocrText}</pre> }] : []),
              ]}
            />
          ) : null}
        </>
      ) : sheetTable ?? <Alert type="info" showIcon message="برای این مورد فایل پیش‌نمایش وجود ندارد (داده نمونه یا ورود دستی)." />}
      {sel != null && item.src[sel] ? (
        <Alert style={{ marginTop: 8 }} type="info" message="متن خوانده‌شده برای ردیف انتخاب‌شده" description={<span style={{ whiteSpace: 'pre-wrap' }}>{item.src[sel]}</span>} />
      ) : null}
    </div>
  );

  const unit: Unit = item.payroll?.unit ?? item.payments?.unit ?? item.insurance?.unit ?? 'unknown';
  const bankOpts = accountOpts(banks);

  return (
    <Drawer open width="100%" onClose={onClose} title={`بررسی: ${item.fileName} — ${KIND_TITLE[kind]}`} destroyOnClose footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>بستن</Button>
          <Button danger onClick={() => { onPatch((q) => ({ ...q, status: 'rejected' })); onClose(); }}>رد کردن این سند</Button>
          <Button type="primary" disabled={!ok} loading={busy} onClick={create}>ایجاد پیش‌نویس سند</Button>
        </div>
      }>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>{preview}</Col>
        <Col xs={24} lg={15}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert type="warning" showIcon message="خروجی همیشه «پیش‌نویس» است؛ هیچ سندی قطعی نمی‌شود. اعداد استخراج‌شده تا تأیید شما معتبر نیستند." />
            <Row gutter={[12, 12]}>
              {field('واحد مبلغ در سند', <Select style={{ width: '100%' }} status={unit === 'unknown' ? 'error' : undefined} value={unit} options={UNIT_OPTS} onChange={setUnit} />)}
              {field('تاریخ سند', <Input value={date} status={vDate ? undefined : 'error'} onChange={(e) => setDate(e.target.value.trim())} />)}
              {kind !== 'payroll' ? field('پرداخت از حساب', <Select style={{ width: '100%' }} showSearch optionFilterProp="label" placeholder="بانک/صندوق" value={bankId || undefined} options={bankOpts} onChange={setBankId} />) : null}
              {kind === 'payroll' && item.payroll ? field('دورهٔ حقوق (مثلاً 1405/08)', <Input value={item.payroll.period} status={/^\d{4}\/\d{2}$/.test(item.payroll.period) ? undefined : 'error'} onChange={(e) => onPatch((q) => (q.payroll ? { ...q, payroll: { ...q.payroll, period: parsePeriod(e.target.value) ?? e.target.value } } : q))} />) : null}
              {field('شرح سند', <Input value={desc} placeholder="خودکار" onChange={(e) => setDesc(e.target.value)} />)}
            </Row>

            {mapping && item.sheets && (kind === 'payroll' || kind === 'payment') ? (
              <Alert
                type={mapping.confidence < 0.6 ? 'warning' : 'info'}
                message={mapping.confidence < 0.6 ? 'ستون‌ها با اطمینان پایین شناسایی شدند؛ نگاشت را اصلاح کنید.' : 'نگاشت ستون‌ها'}
                description={
                  <Space wrap>
                    {item.sheets.length > 1 ? <Select style={{ width: 160 }} value={item.sheetIdx ?? 0} options={item.sheets.map((s, i) => ({ value: i, label: s.name }))} onChange={(i) => rebuild(i, guessMapping(item.sheets?.[i]?.rows ?? [], kind))} /> : null}
                    <span>ردیف سرستون:</span>
                    <NumInput style={{ width: 70 }} value={mapping.headerRow + 1} onChange={(v) => rebuild(item.sheetIdx ?? 0, { ...mapping, headerRow: Math.max(0, (Number(v) || 1) - 1), confidence: 1 })} />
                    {KIND_FIELDS[kind].map((f: FieldKey) => (
                      <span key={f}>
                        {FIELD_LABEL[f]}:{' '}
                        <Select
                          size="small" style={{ width: 120 }} allowClear placeholder="—"
                          value={mapping.cols[f]}
                          options={(sheet?.rows[mapping.headerRow] ?? []).map((h, i) => ({ value: i, label: h || `ستون ${i + 1}` }))}
                          onChange={(v) => {
                            const cols = { ...mapping.cols };
                            if (v === undefined) delete cols[f];
                            else cols[f] = v;
                            rebuild(item.sheetIdx ?? 0, { ...mapping, cols, confidence: 1 });
                          }}
                        />
                      </span>
                    ))}
                  </Space>
                }
              />
            ) : null}

            {kind === 'payroll' && item.payroll ? (
              <>
                <Table<PayrollRow> size="small" rowKey="id" pagination={false} bordered scroll={{ x: 1500 }} dataSource={item.payroll.rows} columns={payrollCols} onRow={(r) => ({ onClick: () => setSel(r.id), style: { background: rowBg(r.conf, r.confirmed) } })} />
                <Space wrap>
                  <Button onClick={() => onPatch((q) => (q.payroll ? { ...q, payroll: { ...q.payroll, rows: [...q.payroll.rows, newPayrollRow()] } } : q))}>+ ردیف</Button>
                  <Text type="secondary">
                    جمع: ناخالص {fmtNum(payrollTotals(item.payroll.rows).gross)} | بیمه کارمند {fmtNum(payrollTotals(item.payroll.rows).employeeInsurance)} | مالیات {fmtNum(payrollTotals(item.payroll.rows).incomeTax)} | خالص {fmtNum(payrollTotals(item.payroll.rows).net)} | سهم کارفرما ({rates.employer + rates.unemployment}٪){employerShare(item.payroll, rates).fromDocument ? ' (طبق سند)' : ''}: {fmtNum(employerShare(item.payroll, rates).value)}
                  </Text>
                </Space>
              </>
            ) : null}

            {kind === 'payment' && payments ? (
              <>
                <Table<PayRow> size="small" rowKey="id" pagination={false} bordered scroll={{ x: 1500 }} dataSource={payments.rows} columns={payCols} onRow={(r) => ({ onClick: () => setSel(r.id), style: { background: rowBg(r.conf, r.confirmed) } })} />
                <Button onClick={() => onPatch((q) => (q.payments ? { ...q, payments: { ...q.payments, rows: [...q.payments.rows, newPayRow()] } } : q))}>+ ردیف</Button>
              </>
            ) : null}

            {kind === 'insurance' && ins ? (
              <Row gutter={[12, 12]}>
                {field('پرداخت‌کننده', <Input value={ins.payerName} onChange={(e) => patchIns({ payerName: e.target.value }, 'پرداخت‌کننده', ins.payerName, e.target.value)} />)}
                {field('مبلغ کل پرداختی', <NumInput value={ins.amount} onChange={(v) => patchIns({ amount: Number(v) || 0 }, 'مبلغ', ins.amount, Number(v) || 0)} />)}
                {field('جریمه دیرکرد (اگر در فیش چاپ شده)', <NumInput value={ins.penalty} onChange={(v) => patchIns({ penalty: Number(v) || 0 }, 'جریمه', ins.penalty, Number(v) || 0)} />)}
                {field('تاریخ پرداخت', <Input value={ins.date} status={ins.date && !parseJalaliDate(ins.date) ? 'error' : undefined} onChange={(e) => { patchIns({ date: e.target.value }, 'تاریخ', ins.date, e.target.value); const d = parseJalaliDate(e.target.value); if (d) setDate(d.j); }} />)}
                {field('شمارهٔ پیگیری', <Input value={ins.trackingNo} status={ins.trackingNo.trim() ? undefined : 'error'} onChange={(e) => patchIns({ trackingNo: e.target.value }, 'پیگیری', ins.trackingNo, e.target.value)} />)}
                {field('شمارهٔ لیست', <Input value={ins.listNo} onChange={(e) => patchIns({ listNo: e.target.value }, 'شمارهٔ لیست', ins.listNo, e.target.value)} />)}
                {field('دورهٔ بیمه (مثلاً 1405/08)', <Input value={ins.periodMonth} onChange={(e) => patchIns({ periodMonth: parsePeriod(e.target.value) ?? e.target.value }, 'دوره', ins.periodMonth, e.target.value)} />)}
                {view.extra && view.extra.diff != null && view.extra.diff > 0 ? field('نحوهٔ ثبت مازاد نسبت به بدهی باز', <Select style={{ width: '100%' }} value={ins.diffMode} options={[{ value: 'payable', label: 'همه در «بیمه پرداختنی»' }, { value: 'penalty', label: 'مازاد در «هزینه جریمه»' }]} onChange={(v) => patchIns({ diffMode: v }, 'نحوهٔ ثبت مازاد', ins.diffMode, v)} />) : null}
                {field('اطمینان / تأیید', <Space>{confTag(ins.conf, ins.confirmed)}<Checkbox checked={ins.confirmed} onChange={(e) => onPatch((q) => (q.insurance ? { ...q, insurance: { ...q.insurance, confirmed: e.target.checked } } : q))}>بررسی شد</Checkbox></Space>)}
              </Row>
            ) : null}

            <div>
              <Space style={{ marginBottom: 8 }}>
                <Text strong>پیش‌نمایش سند (پیش‌نویس)</Text>
                {view.draft.lines.length ? (view.draft.balanced ? <Tag color="green">متوازن</Tag> : <Tag color="red">نامتوازن</Tag>) : null}
              </Space>
              <Table
                size="small" rowKey={(_r: Line, i?: number) => String(i)} pagination={false} bordered
                dataSource={view.draft.lines}
                columns={[
                  { title: 'حساب', render: (_v: unknown, l: Line) => (l.role === 'bank' ? bankOpts.find((b) => b.value === bankId)?.label ?? 'بانک (انتخاب نشده)' : accName(init.settings.acc[l.role]) || `${ROLE_LABEL[l.role]} (تنظیم نشده)`) },
                  { title: 'شخص', render: (_v: unknown, l: Line) => l.person?.name ?? '' },
                  { title: 'شرح', dataIndex: 'description' },
                  { title: 'بدهکار', align: 'end', render: (_v: unknown, l: Line) => (l.debit ? fmtNum(l.debit) : '') },
                  { title: 'بستانکار', align: 'end', render: (_v: unknown, l: Line) => (l.credit ? fmtNum(l.credit) : '') },
                ]}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={3}><b>جمع</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="end"><b>{fmtNum(view.draft.totalDebit)}</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="end"><b>{fmtNum(view.draft.totalCredit)}</b></Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </div>

            <Space direction="vertical" style={{ width: '100%' }} size={4}>
              {issues.map((i, k) => (
                <Alert key={k} type={i.severity === 'block' ? 'error' : 'warning'} showIcon message={i.message} />
              ))}
            </Space>
          </Space>
        </Col>
      </Row>
    </Drawer>
  );
}
