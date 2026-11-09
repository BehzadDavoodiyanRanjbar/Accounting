import { DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { App, Alert, Button, Card, Checkbox, Input, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { csCall } from '../../api/costService';
import { fmtNum, str, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Opt, Row } from '../../kit/types';
import { NeedCompany, isOn, num, useBankAccounts, useBankCall } from '../bank/common';
import { AC_D4 } from './common';
import { printVoucher } from './voucherPrint';
import { NumInput } from '../../kit/NumInput';

interface AccO {
  AccID: string;
  Code: string;
  Name: string;
  Det4?: string;
  Det5?: string;
  Det6?: string;
  ReqDate?: boolean;
  ReqTxt?: boolean;
  ReqNum?: boolean;
  Post?: boolean;
  IsActive?: boolean;
}
interface AccOptions {
  accounts: AccO[];
  details: Array<{ id: string; Code: string; Name: string; IsActive?: boolean }>;
  employees: Array<{ id: string; Code: string; Name: string; IsActive?: boolean }>;
  projects: Array<{ id: string; Code: string; Name: string; IsActive?: boolean }>;
}
interface VRow {
  k: number;
  acc: string;
  det: string;
  party: string;
  proj: string;
  ad: string;
  at: string;
  an: string;
  desc: string;
  debit: string;
  credit: string;
}

let uid = 1;
const blank = (): VRow => ({ k: uid++, acc: '', det: '', party: '', proj: '', ad: '', at: '', an: '', desc: '', debit: '', credit: '' });
const r2 = (n: number) => Math.round(n * 100) / 100;
const cl = (c: unknown, n: unknown) => `${c ? `${str(c)} - ` : ''}${str(n)}`;
const money = (v: string) => {
  const n = num(v);
  return n ? fmtNum(n, 2) : '';
};
const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const act = (x: { IsActive?: boolean | string | number }) => x.IsActive === undefined || isOn(x.IsActive);

/** فرم سند حسابداری (ثبت و ویرایش با ۶ سطح) */
export default function VoucherFormPage() {
  const { company, data, companies } = useCompany();
  const { message, modal, notification } = App.useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const id = sp.get('id') ?? '';
  const opts = useCsQuery<AccOptions>('accOptions', {});
  const bank = useBankAccounts();
  const call = useBankCall();

  const [head, setHead] = useState<Row>({});
  const [rows, setRows] = useState<VRow[]>([]);
  const [autoNo, setAutoNo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const seq = useRef(0);

  const meta = { status: str(head.Status), source: str(head.Source) };
  const ed = !!id;
  const ro = ed && (meta.source === 'auto' || meta.source === 'sys');

  const reset = useCallback(() => {
    setHead({ No: '', Ref: '', DateJalali: todayJalali(), Time: nowTime(), Description: '', ProjID: '', Status: '', Source: 'manual' });
    setRows([blank(), blank(), blank(), blank(), blank()]);
    setAutoNo(true);
    setLoadErr('');
  }, []);

  useEffect(() => {
    if (!company) return;
    if (!id) return reset();
    const my = ++seq.current;
    setLoading(true);
    csCall<Row>('voucherGet', company, { id })
      .then((r) => {
        if (my !== seq.current) return;
        setHead(r.head ?? {});
        setAutoNo(false);
        const rs: VRow[] = (r.rows ?? []).map((x: Row) => ({
          k: uid++,
          acc: str(x.AccID),
          det: str(x.DetID),
          party: x.PartyID ? `${str(x.PartyType)}:${str(x.PartyID)}` : '',
          proj: str(x.ProjID),
          ad: str(x.AtfDate),
          at: str(x.AtfTxt),
          an: str(x.AtfNum),
          desc: str(x.Description),
          debit: x.Debit ? fmtNum(x.Debit, 2) : '',
          credit: x.Credit ? fmtNum(x.Credit, 2) : '',
        }));
        while (rs.length < 5) rs.push(blank());
        setRows(rs);
        setLoadErr('');
      })
      .catch((e) => my === seq.current && setLoadErr(errorMessage(e)))
      .finally(() => my === seq.current && setLoading(false));
  }, [company, id, reset, sp]);

  const accs = opts.data?.accounts ?? [];
  const accById = useMemo(() => Object.fromEntries(accs.map((a) => [a.AccID, a])), [accs]);
  const accOpts = useMemo<Opt[]>(() => accs.filter((a) => a.IsActive !== false && a.Post !== false).map((a) => ({ value: a.AccID, label: cl(a.Code, a.Name) })), [accs]);

  const detOpts = useMemo<Record<string, Opt[]>>(() => {
    const o = opts.data;
    const bk = (k: string): Opt[] => (bank.data?.rows ?? []).filter((a) => a.Kind === k && isOn(a.IsActive)).map((a) => ({ value: a.AccountID, label: a.Name }));
    return {
      detail: (o?.details ?? []).filter(act).map((d) => ({ value: d.id, label: cl(d.Code, d.Name) })),
      bank: bk('bank'),
      cash: bk('cash'),
      imprest: bk('imprest'),
      product: (data?.products ?? []).filter((p) => p.CompanyID === company && act(p as Row)).map((p) => ({ value: str(p.ProductID), label: cl(p.ProductCode, p.Name) })),
    };
  }, [opts.data, bank.data, data, company]);

  const partyOpts = useMemo<Opt[]>(() => {
    const mine = (a?: Row[]) => (a ?? []).filter((r) => r.CompanyID === company && act(r));
    return [
      ...mine(data?.customers as Row[]).map((c) => ({ value: `customer:${str(c.CustomerID)}`, label: `خریدار: ${cl(c.CustomerCode, c.Name)}` })),
      ...mine(data?.suppliers as Row[]).map((c) => ({ value: `supplier:${str(c.SupplierID)}`, label: `فروشنده: ${cl(c.SupplierCode, c.Name)}` })),
      ...(opts.data?.employees ?? []).filter(act).map((c) => ({ value: `employee:${c.id}`, label: `کارمند: ${cl(c.Code, c.Name)}` })),
    ];
  }, [data, company, opts.data]);

  const prjOpts = useMemo<Opt[]>(() => (opts.data?.projects ?? []).filter(act).map((p) => ({ value: p.id, label: cl(p.Code, p.Name) })), [opts.data]);

  const patch = (k: number, p: Partial<VRow>) =>
    setRows((rs) => {
      let out = rs.map((r) => (r.k === k ? { ...r, ...p } : r));
      const last = out[out.length - 1];
      if (last && last.acc) out = [...out, blank()];
      return out;
    });

  const onAcc = (k: number, v: string | undefined) => {
    const a = v ? accById[v] : undefined;
    setRows((rs) => {
      let out = rs.map((r) => {
        if (r.k !== k) return r;
        const n: VRow = { ...r, acc: v ?? '' };
        if (!a) return n;
        if (!a.Det4 || a.Det4 !== accById[r.acc]?.Det4) n.det = '';
        if (!a.Det5) n.party = '';
        if (!a.Det6) n.proj = '';
        else if (!n.proj && head.ProjID) n.proj = str(head.ProjID);
        return n;
      });
      const last = out[out.length - 1];
      if (last && last.acc) out = [...out, blank()];
      return out;
    });
  };

  const totals = useMemo(() => {
    const D = r2(rows.reduce((t, r) => t + num(r.debit), 0));
    const C = r2(rows.reduce((t, r) => t + num(r.credit), 0));
    return { D, C, diff: r2(D - C) };
  }, [rows]);
  const ok = Math.abs(totals.diff) < 0.005;

  const fill = (r: VRow, side: 'D' | 'C') => {
    if (side === 'C' ? r.credit : r.debit) return;
    if (side === 'C' && totals.diff > 0.004) patch(r.k, { credit: fmtNum(totals.diff, 2), debit: '' });
    if (side === 'D' && totals.diff < -0.004) patch(r.k, { debit: fmtNum(-totals.diff, 2), credit: '' });
  };

  const save = async (status: 'draft' | 'confirmed') => {
    const out: Row[] = [];
    let err = '';
    rows.forEach((r, i) => {
      if (!r.acc && !r.det && !r.party && !r.proj && !r.desc.trim() && !num(r.debit) && !num(r.credit)) return;
      if (!r.acc) err = err || `ردیف ${i + 1}: حساب را انتخاب کنید.`;
      const s = r.party.indexOf(':');
      out.push({ AccID: r.acc, DetID: r.det, PartyType: s > 0 ? r.party.slice(0, s) : '', PartyID: s > 0 ? r.party.slice(s + 1) : '', ProjID: r.proj, Description: r.desc, Debit: num(r.debit) || '', Credit: num(r.credit) || '', AtfDate: r.ad, AtfTxt: r.at, AtfNum: r.an });
    });
    if (err) return void message.warning(err);
    setSaving(true);
    try {
      const o: Row = { VID: id, No: autoNo ? '' : str(head.No), Ref: str(head.Ref), DateJalali: str(head.DateJalali), Time: str(head.Time), Description: str(head.Description), ProjID: str(head.ProjID), Status: status, rows: out };
      const r = await call('voucherSave', { obj: o });
      message.success(`${status === 'draft' ? 'پیش‌نویس سند ' : 'سند '}${str(r.No)} ذخیره شد.`);
      nav(`/p/ac_new?id=${encodeURIComponent(str(r.VID))}`);
    } catch (e) {
      notification.error({ message: 'ذخیره انجام نشد', description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const del = () =>
    modal.confirm({
      title: 'حذف سند',
      content: 'این سند حذف شود؟',
      okText: 'حذف',
      okButtonProps: { danger: true },
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          await call('voucherDelete', { id });
          message.success('سند حذف شد.');
          nav('/p/ac_list');
        } catch (e) {
          notification.error({ message: 'حذف انجام نشد', description: errorMessage(e) });
        }
      },
    });

  const print = async (o: 'L' | 'P') => {
    try {
      const r = await csCall<Row>('voucherGet', company, { id });
      const co = companies.find((c) => c.CompanyID === company);
      if (!printVoucher(r, o, str(co?.Name))) message.warning('پنجرهٔ چاپ مسدود شد؛ اجازهٔ باز شدن پنجره را بدهید.');
    } catch (e) {
      notification.error({ message: 'چاپ انجام نشد', description: errorMessage(e) });
    }
  };

  const copyDesc = () => {
    const d = str(head.Description);
    if (d) setRows((rs) => rs.map((r) => (!r.desc && r.acc ? { ...r, desc: d } : r)));
  };

  const dup = (k: number) =>
    setRows((rs) => {
      const i = rs.findIndex((r) => r.k === k);
      const c = { ...rs[i], k: uid++ };
      return [...rs.slice(0, i + 1), c, ...rs.slice(i + 1)];
    });
  const del1 = (k: number) =>
    setRows((rs) => (rs.length <= 2 ? rs.map((r) => (r.k === k ? blank() : r)) : rs.filter((r) => r.k !== k)));

  const sel = (value: string, options: Opt[], onChange: (v: string) => void, disabled?: boolean, ph?: string, w = 170) => (
    <Select showSearch allowClear optionFilterProp="label" style={{ width: w }} disabled={disabled || ro} placeholder={ph} value={value || undefined} options={options} onChange={(v) => onChange(v ?? '')} />
  );

  const cols: TableColumnsType<VRow> = [
    { title: '#', key: 'i', width: 44, render: (_, __, i) => i + 1 },
    { title: 'حساب (کد یا نام)', key: 'acc', width: 260, render: (_, r) => sel(r.acc, accOpts, (v) => onAcc(r.k, v || undefined), false, 'حساب', 250) },
    {
      title: 'تفصیلی',
      key: 'det',
      width: 190,
      render: (_, r) => {
        const a = accById[r.acc];
        const kind = a?.Det4 ?? '';
        return sel(r.det, detOpts[kind] ?? [], (v) => patch(r.k, { det: v }), !!a && !kind, kind ? `${AC_D4[kind]} (الزامی)` : '', 180);
      },
    },
    {
      title: 'شخص / مرکز هزینه',
      key: 'party',
      width: 200,
      render: (_, r) => {
        const a = accById[r.acc];
        return sel(r.party, partyOpts, (v) => patch(r.k, { party: v }), !!a && !a.Det5, a?.Det5 === 'req' ? 'خریدار/فروشنده/کارمند (الزامی)' : 'خریدار/فروشنده/کارمند', 190);
      },
    },
    {
      title: 'پروژه',
      key: 'proj',
      width: 150,
      render: (_, r) => {
        const a = accById[r.acc];
        return sel(r.proj, prjOpts, (v) => patch(r.k, { proj: v }), !!a && !a.Det6, a?.Det6 === 'req' ? 'پروژه (الزامی)' : 'پروژه', 140);
      },
    },
    { title: 'تاریخ عطف', key: 'ad', width: 110, render: (_, r) => <Input disabled={ro || (!!accById[r.acc] && !accById[r.acc].ReqDate && !r.ad)} placeholder={accById[r.acc]?.ReqDate ? 'الزامی' : '1405/01/01'} value={r.ad} onChange={(e) => patch(r.k, { ad: e.target.value })} /> },
    { title: 'عطف حرفی', key: 'at', width: 120, render: (_, r) => <Input disabled={ro || (!!accById[r.acc] && !accById[r.acc].ReqTxt && !r.at)} placeholder={accById[r.acc]?.ReqTxt ? 'الزامی' : ''} value={r.at} onChange={(e) => patch(r.k, { at: e.target.value })} /> },
    { title: 'عطف عددی', key: 'an', width: 110, render: (_, r) => <Input disabled={ro || (!!accById[r.acc] && !accById[r.acc].ReqNum && !r.an)} placeholder={accById[r.acc]?.ReqNum ? 'الزامی' : ''} value={r.an} onChange={(e) => patch(r.k, { an: e.target.value })} /> },
    { title: 'شرح', key: 'desc', width: 190, render: (_, r) => <Input disabled={ro} value={r.desc} onChange={(e) => patch(r.k, { desc: e.target.value })} /> },
    {
      title: 'بدهکار',
      key: 'D',
      width: 140,
      render: (_, r) => (
        <NumInput
          disabled={ro}
          value={r.debit}
          onChange={(v) => patch(r.k, { debit: v, ...(num(v) ? { credit: '' } : {}) })}
          onBlur={() => patch(r.k, { debit: money(r.debit) })}
          onDoubleClick={() => fill(r, 'D')}
        />
      ),
    },
    {
      title: 'بستانکار',
      key: 'C',
      width: 140,
      render: (_, r) => (
        <NumInput
          disabled={ro}
          value={r.credit}
          onChange={(v) => patch(r.k, { credit: v, ...(num(v) ? { debit: '' } : {}) })}
          onBlur={() => patch(r.k, { credit: money(r.credit) })}
          onDoubleClick={() => fill(r, 'C')}
        />
      ),
    },
    {
      title: '',
      key: 'x',
      width: 80,
      render: (_, r) =>
        ro ? null : (
          <Space size={2}>
            <Button size="small" type="text" icon={<CopyOutlined />} title="کپی ردیف" onClick={() => dup(r.k)} />
            <Button size="small" type="text" danger icon={<DeleteOutlined />} title="حذف ردیف" onClick={() => del1(r.k)} />
          </Space>
        ),
    },
  ];

  const setH = (p: Row) => setHead((h) => ({ ...h, ...p }));

  return (
    <NeedCompany company={company}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Typography.Title level={3} style={{ margin: 0 }}>
              سند حسابداری{ed ? ` شماره ${str(head.No)}` : ' جدید'}{' '}
              {ed ? <Typography.Text type="secondary" style={{ fontSize: 14 }}>(ارجاع دائمی: {str(head.RefNo) || '—'})</Typography.Text> : null}{' '}
              {ed ? (meta.status === 'draft' ? <Tag>پیش‌نویس</Tag> : <Tag color="green">تأیید شده</Tag>) : null}
              {ro ? <Tag color="blue">{meta.source === 'sys' ? 'سیستمی' : 'خودکار'}</Tag> : null}
            </Typography.Title>
            <Space wrap>
              {ro ? null : <Button type="primary" loading={saving} onClick={() => void save('confirmed')}>تأیید و ذخیره</Button>}
              {ro ? null : <Button loading={saving} onClick={() => void save('draft')}>ذخیره پیش‌نویس</Button>}
              <Button onClick={() => nav(`/p/ac_new?new=${Date.now()}`)}>سند جدید</Button>
              {ed ? <Button onClick={() => void print('L')}>چاپ افقی</Button> : null}
              {ed ? <Button onClick={() => void print('P')}>چاپ عمودی</Button> : null}
              {ed && !ro ? <Button danger onClick={del}>حذف</Button> : null}
              <Button onClick={() => nav('/p/ac_list')}>لیست اسناد</Button>
            </Space>
          </Space>
          {ro ? (
            <Alert
              type="info"
              showIcon
              message={meta.source === 'sys' ? 'این سند را سیستم هنگام بستن/افتتاح سال مالی ساخته است و ویرایش یا حذف نمی‌شود؛ برای تغییر، مدیر سیستم باید سال را «باز کند» یا «بستن مجدد» بزند.' : 'این سند به‌صورت خودکار از روی فاکتور/بانک/چک ساخته شده است؛ برای تغییر، سند مبدأ را اصلاح کنید (سند خودکار با «بازسازی اسناد خودکار» به‌روز می‌شود).'}
            />
          ) : null}
          {loadErr ? <Alert type="error" showIcon message={loadErr} /> : null}
        </Space>
      </Card>
      <Card loading={loading}>
        <Space wrap align="end">
          <label>شماره سند (موقت)<br /><Input style={{ width: 110 }} disabled={autoNo || ro} value={str(head.No)} onChange={(e) => setH({ No: e.target.value })} /></label>
          <Checkbox checked={autoNo} disabled={ed || ro} onChange={(e) => { setAutoNo(e.target.checked); if (e.target.checked) setH({ No: '' }); }}>اتوماتیک</Checkbox>
          <label>شماره ارجاع (دائمی)<br /><Input style={{ width: 110 }} disabled placeholder="پس از ذخیره" value={ed ? str(head.RefNo) : ''} /></label>
          <label>مرجع / توضیح کوتاه<br /><Input style={{ width: 150 }} disabled={ro} value={str(head.Ref)} onChange={(e) => setH({ Ref: e.target.value })} /></label>
          <label>تاریخ *<br /><Input style={{ width: 120 }} disabled={ro} value={str(head.DateJalali)} onChange={(e) => setH({ DateJalali: e.target.value.trim() })} /></label>
          <label>ساعت<br /><Input style={{ width: 80 }} disabled={ro} value={str(head.Time)} onChange={(e) => setH({ Time: e.target.value })} /></label>
          <label>پروژه (کل سند)<br />{sel(str(head.ProjID), prjOpts, (v) => {
            setH({ ProjID: v });
            if (v) setRows((rs) => rs.map((r) => (r.acc && accById[r.acc]?.Det6 && !r.proj ? { ...r, proj: v } : r)));
          }, false, 'بدون پروژه', 170)}</label>
          <label style={{ flex: 1, minWidth: 260 }}>شرح سند<br /><Input disabled={ro} value={str(head.Description)} onChange={(e) => setH({ Description: e.target.value })} /></label>
        </Space>
      </Card>
      <Card
        title="ردیف‌های سند"
        extra={ro ? null : (
          <Space>
            <Button size="small" onClick={() => setRows((rs) => [...rs, blank()])}>+ ردیف</Button>
            <Button size="small" onClick={copyDesc}>کپی شرح سند به ردیف‌های خالی</Button>
          </Space>
        )}
      >
        <Table<VRow> size="small" rowKey="k" columns={cols} dataSource={rows} pagination={false} scroll={{ x: 'max-content' }} />
        <Space size="large" style={{ marginTop: 12 }} wrap>
          <Statistic title="جمع بدهکار" value={fmtNum(totals.D)} />
          <Statistic title="جمع بستانکار" value={fmtNum(totals.C)} />
          <Statistic
            title="اختلاف"
            valueStyle={{ color: ok ? '#389e0d' : '#cf1322' }}
            value={ok ? 'تراز ✔' : `${fmtNum(Math.abs(totals.diff), 2)} ${totals.diff > 0 ? '(بدهکار بیشتر)' : '(بستانکار بیشتر)'}`}
          />
        </Space>
        <Typography.Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
          سند فقط روی حساب «معین» ثبت می‌شود. ستون‌های تفصیلی، شخص و پروژه بر اساس تنظیم هر حساب فعال می‌شوند. برای پر کردن خودکار اختلاف، روی خانهٔ خالی بدهکار/بستانکار دو بار کلیک کنید. سند «تأیید شده» فقط وقتی تراز باشد ذخیره می‌شود.
        </Typography.Paragraph>
      </Card>
    </NeedCompany>
  );
}
