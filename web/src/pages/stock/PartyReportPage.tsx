import { App, Button, Card, Checkbox, Input, Select, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { useCompany } from '../../api/CompanyContext';
import { errorMessage } from '../../api/client';
import { csCall } from '../../api/costService';
import { downloadCsv } from '../../kit/exporter';
import type { ExportCol } from '../../kit/exporter';
import { fmtNum, str, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Row } from '../../kit/types';
import { DateBox, NeedCompany } from '../bank/common';
import { nk } from './common';
import { statementHtml, stNat } from './partyStatementPrint';

type Kind = 'sup' | 'cus';
interface Rep {
  from?: string;
  to?: string;
  sup?: { rows: Row[]; ledger?: Record<string, Row[]> };
  cus?: { rows: Row[]; ledger?: Record<string, Row[]> };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const state = (k: Kind, v: number): string => {
  if (Math.abs(v) < 0.5) return 'تسویه';
  return k === 'sup' ? (v > 0 ? 'ما بدهکاریم' : 'ما طلبکاریم') : v > 0 ? 'ما طلبکاریم' : 'ما بدهکاریم';
};
const money = (v: unknown, bold = false) => {
  const n = Number(v) || 0;
  return <span style={{ color: n < 0 ? '#cf1322' : undefined, fontWeight: bold ? 700 : undefined }}>{fmtNum(n)}</span>;
};
const LBL: Record<Kind, { title: string; a: string; b: string; pay: string; one: string }> = {
  sup: { title: 'فروشندگان (بستانکاران)', a: 'خرید', b: 'برگشت از خرید', pay: 'پرداخت‌ها و تعدیل با سند دستی', one: 'فروشنده' },
  cus: { title: 'خریداران (بدهکاران)', a: 'فروش', b: 'برگشت از فروش', pay: 'دریافت نقدی و تعدیل با سند دستی', one: 'خریدار' },
};

export default function PartyReportPage() {
  const { company, data } = useCompany();
  const { message } = App.useApp();
  const [f, setF] = useState({ from: '', to: '', kind: 'both' });
  const [applied, setApplied] = useState(f);
  const [text, setText] = useState('');
  const [nz, setNz] = useState(false);
  const q = useCsQuery<Rep>('partyReport', applied);
  const rep: Rep = q.data ?? {};
  const companyName = str(((data?.companies ?? []) as Row[]).find((c) => c.CompanyID === company)?.Name);

  const vis = (k: Kind): Row[] => {
    const t = nk(text);
    return (rep[k]?.rows ?? []).filter((x) => (!t || nk(x.name).includes(t)) && (!nz || Math.abs(Number(x.closing)) >= 0.5));
  };
  const sums = (a: Row[]) => {
    const t = { opening: 0, a: 0, b: 0, pay: 0, closing: 0 };
    a.forEach((x) => {
      t.opening += Number(x.opening) || 0;
      t.a += Number(x.a) || 0;
      t.b += Number(x.b) || 0;
      t.pay += (Number(x.c) || 0) - (Number(x.d) || 0);
      t.closing += Number(x.closing) || 0;
    });
    (Object.keys(t) as (keyof typeof t)[]).forEach((k) => (t[k] = r2(t[k])));
    return t;
  };

  const openStatement = async (sup: string, cus: string) => {
    const w = window.open('', '_blank');
    if (!w) {
      message.error('مرورگر تب جدید را مسدود کرد؛ اجازه‌ی باز شدن پنجره‌ی جدید را بدهید.');
      return;
    }
    w.document.write('<p dir="rtl" style="font-family:Tahoma;padding:20px">در حال تهیه‌ی گزارش...</p>');
    try {
      const r = await csCall<Row>('partyStatement', company, { from: applied.from, to: applied.to, kind: applied.kind, supplier: sup, customer: cus });
      w.document.open();
      w.document.write(statementHtml(r, companyName));
      w.document.close();
    } catch (e) {
      try {
        w.close();
      } catch {
        /* ignore */
      }
      message.error(errorMessage(e));
    }
  };

  const per = rep.from || rep.to ? `(${rep.from ? 'از ' + rep.from : ''} ${rep.to ? 'تا ' + rep.to : ''})` : '';
  const stamp = todayJalali().replace(/\//g, '-');

  const exportSummary = () => {
    const cols: ExportCol<Row>[] = [
      { title: 'نوع', value: (r) => r.kindName },
      { title: 'نام', value: (r) => r.name },
      { title: 'مانده ابتدای دوره', numeric: true, value: (r) => r.opening },
      { title: 'خرید / فروش', numeric: true, value: (r) => r.a },
      { title: 'برگشت', numeric: true, value: (r) => r.b },
      { title: 'پرداخت / دریافت', numeric: true, value: (r) => r.pay },
      { title: 'مانده پایان', numeric: true, value: (r) => r.closing },
      { title: 'وضعیت', value: (r) => r.state },
    ];
    const rows: Row[] = [];
    (['sup', 'cus'] as Kind[]).forEach((k) =>
      vis(k).forEach((x) => rows.push({ kindName: LBL[k].one, name: x.name, opening: x.opening, a: x.a, b: x.b, pay: r2((Number(x.c) || 0) - (Number(x.d) || 0)), closing: x.closing, state: state(k, Number(x.closing) || 0) })),
    );
    downloadCsv(`party-accounts-${stamp}`, cols, rows, undefined, ['فروشنده: مانده مثبت = ما بدهکاریم. خریدار: مانده مثبت = ما طلبکاریم.']);
  };

  const exportDetail = async () => {
    try {
      const r = await csCall<Rep>('partyReport', company, { ...applied, detail: true });
      const cols: ExportCol<Row>[] = [
        { title: 'نوع', value: (x) => x.kindName },
        { title: 'نام', value: (x) => x.name },
        { title: 'ردیف', value: (x) => x.i },
        { title: 'شماره صورتحساب', value: (x) => x.no },
        { title: 'تاریخ صورتحساب', value: (x) => x.j },
        { title: 'شرح', value: (x) => x.desc },
        { title: 'بدهکار', numeric: true, value: (x) => x.deb },
        { title: 'بستانکار', numeric: true, value: (x) => x.cred },
        { title: 'مانده', numeric: true, value: (x) => x.bal },
        { title: 'ماهیت', value: (x) => x.nat },
      ];
      const rows: Row[] = [];
      (['sup', 'cus'] as Kind[]).forEach((k) => {
        const part = r[k];
        if (!part) return;
        const t = nk(text);
        part.rows
          .filter((x) => (!t || nk(x.name).includes(t)) && (!nz || Math.abs(Number(x.closing)) >= 0.5))
          .forEach((x) => {
            let bal = k === 'sup' ? -(Number(x.opening) || 0) : Number(x.opening) || 0;
            const base = { kindName: LBL[k].one, name: x.name };
            rows.push({ ...base, desc: 'مانده ابتدای دوره', bal: Math.abs(bal), nat: stNat(bal) });
            let i = 0;
            ((part.ledger?.[x.id] ?? []) as Row[]).forEach((z) => {
              const deb = k === 'sup' ? Number(z.dec) || 0 : Number(z.inc) || 0;
              const cred = k === 'sup' ? Number(z.inc) || 0 : Number(z.dec) || 0;
              bal = r2(bal + deb - cred);
              rows.push({ ...base, i: ++i, no: z.no, j: z.j, desc: z.desc || z.kind, deb: deb || '', cred: cred || '', bal: Math.abs(bal), nat: stNat(bal) });
            });
          });
      });
      downloadCsv(`party-ledger-${stamp}`, cols, rows, undefined, ['بدهکار = فروش به شخص / پرداخت به او؛ بستانکار = خرید از شخص / دریافت از او']);
    } catch (e) {
      message.error(errorMessage(e));
    }
  };

  const table = (k: Kind) => {
    const rows = vis(k);
    const T = sums(rows);
    const l = LBL[k];
    const cols: TableColumnsType<Row> = [
      {
        title: 'نام',
        dataIndex: 'name',
        render: (v: unknown, r) => (
          <span>
            {str(v)} {r.pair ? <Tag color="blue" title={`این شخص هم در فهرست ${k === 'sup' ? 'خریداران' : 'فروشندگان'} هست؛ «ریز» هر دو را ادغام می‌کند`}>مشترک</Tag> : null}
          </span>
        ),
      },
      { title: 'مانده ابتدای دوره', dataIndex: 'opening', align: 'right', render: (v: unknown) => money(v) },
      { title: l.a, dataIndex: 'a', align: 'right', render: (v: unknown) => money(v) },
      { title: l.b, dataIndex: 'b', align: 'right', render: (v: unknown) => money(v) },
      { title: l.pay, align: 'right', render: (_, r) => money((Number(r.c) || 0) - (Number(r.d) || 0)) },
      { title: 'مانده پایان', dataIndex: 'closing', align: 'right', render: (v: unknown) => money(v, true) },
      { title: 'وضعیت', render: (_, r) => state(k, Number(r.closing) || 0) },
      {
        title: '',
        render: (_, r) => (
          <Button size="small" onClick={() => (k === 'sup' ? openStatement(str(r.id), str(r.pair)) : openStatement(str(r.pair), str(r.id)))}>
            ریز
          </Button>
        ),
      },
    ];
    return (
      <Card size="small" key={k} title={`${l.title} ${per}`}>
        <Table<Row>
          size="small"
          bordered
          columns={cols}
          dataSource={rows}
          rowKey="id"
          pagination={{ pageSize: 100, showSizeChanger: true, pageSizeOptions: [50, 100, 200, 500] }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'موردی برای نمایش نیست.' }}
          summary={() => (
            <Table.Summary.Row style={{ background: '#f2f4f7', fontWeight: 700 }}>
              <Table.Summary.Cell index={0}>جمع ({rows.length} مورد)</Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">{money(T.opening)}</Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">{money(T.a)}</Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">{money(T.b)}</Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">{money(T.pay)}</Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">{money(T.closing, true)}</Table.Summary.Cell>
              <Table.Summary.Cell index={6}>{state(k, T.closing)}</Table.Summary.Cell>
              <Table.Summary.Cell index={7} />
            </Table.Summary.Row>
          )}
        />
      </Card>
    );
  };

  const both = useMemo(() => {
    if (!rep.sup || !rep.cus) return [];
    const cm: Record<string, Row> = {};
    rep.cus.rows.forEach((c) => (cm[c.id] = c));
    const t = nk(text);
    return rep.sup.rows
      .filter((x) => x.pair && cm[x.pair] && (!t || nk(x.name).includes(t)))
      .map((x) => {
        const c = cm[x.pair];
        const sv = -(Number(x.closing) || 0);
        const cv = Number(c.closing) || 0;
        return { id: str(x.id), cusId: str(c.id), name: x.name, sv, cv, net: r2(sv + cv) } as Row;
      });
  }, [rep, text]);
  const bothTotal = r2(both.reduce((s, x) => s + x.net, 0));
  const netState = (n: number) => (Math.abs(n) < 0.5 ? 'تسویه' : n > 0 ? 'ما طلبکاریم' : 'ما بدهکاریم');

  return (
    <NeedCompany company={company}>
      <Card size="small">
        <Typography.Title level={5} style={{ marginTop: 0 }}>گزارش حساب فروشندگان و خریداران</Typography.Title>
        <Space wrap>
          <DateBox value={f.from} onChange={(v) => setF({ ...f, from: v })} placeholder="از تاریخ" />
          <DateBox value={f.to} onChange={(v) => setF({ ...f, to: v })} placeholder="تا تاریخ" />
          <Select
            style={{ width: 200 }}
            value={f.kind}
            onChange={(v) => setF({ ...f, kind: v })}
            options={[
              { value: 'both', label: 'فروشندگان و خریداران' },
              { value: 'sup', label: 'فقط فروشندگان' },
              { value: 'cus', label: 'فقط خریداران' },
            ]}
          />
          <Input allowClear placeholder="جستجوی نام" style={{ width: 180 }} value={text} onChange={(e) => setText(e.target.value)} />
          <Checkbox checked={nz} onChange={(e) => setNz(e.target.checked)}>فقط دارای مانده</Checkbox>
          <Button type="primary" loading={q.isFetching} onClick={() => setApplied({ ...f })}>نمایش گزارش</Button>
          <Button onClick={exportSummary}>خروجی خلاصه (CSV)</Button>
          <Button onClick={exportDetail}>خروجی ریز حساب (CSV)</Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ margin: '8px 0 0', fontSize: 12 }}>
          <b>فروشندگان:</b> مانده = خرید − برگشت از خرید − پرداخت‌ها (چک برگشتی حساب نمی‌شود). مانده‌ی مثبت یعنی ما به فروشنده بدهکاریم؛ منفی (قرمز) یعنی فروشنده به ما بدهکار است.
          <br />
          <b>خریداران:</b> مانده = فروش − برگشت از فروش − مبلغ نقدی دریافتی در همان فاکتورها (کنارگذاشته/ابطال/ردشده حساب نمی‌شود). مانده‌ی مثبت یعنی خریدار به ما بدهکار است. اگر مبلغ فاکتورهای نسیه را بعداً دریافت کرده‌اید، چون در این برنامه «دریافت از مشتری» جداگانه ثبت نمی‌شود، آن را در مانده نمی‌بینید.
          <br />
          اگر «از تاریخ» را بزنید، مانده‌ی ابتدای دوره از اسناد قبل از آن تاریخ محاسبه می‌شود. برای دیدن ریز هر طرف‌حساب دکمه‌ی «ریز» را بزنید.
        </Typography.Paragraph>
      </Card>
      {rep.sup ? table('sup') : null}
      {rep.cus ? table('cus') : null}
      {both.length ? (
        <Card size="small" title="اشخاص مشترک (هم فروشنده، هم خریدار) — مانده‌ی ادغام‌شده">
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            مانده‌ی نهایی = جمع جبری دو گزارش. مثبت = او به ما بدهکار است (طلب ما)؛ منفی (قرمز) = ما به او بدهکاریم.
          </Typography.Paragraph>
          <Table<Row>
            size="small"
            bordered
            pagination={false}
            rowKey="id"
            dataSource={both}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: 'نام', dataIndex: 'name' },
              { title: 'مانده به‌عنوان فروشنده', dataIndex: 'sv', align: 'right', render: (v: unknown) => money(v) },
              { title: 'مانده به‌عنوان خریدار', dataIndex: 'cv', align: 'right', render: (v: unknown) => money(v) },
              { title: 'مانده نهایی', dataIndex: 'net', align: 'right', render: (v: unknown) => money(v, true) },
              { title: 'وضعیت', render: (_, r) => netState(Number(r.net)) },
              { title: '', render: (_, r) => <Button size="small" onClick={() => openStatement(str(r.id), str(r.cusId))}>ریز ادغام‌شده</Button> },
            ]}
            summary={() => (
              <Table.Summary.Row style={{ background: '#f2f4f7', fontWeight: 700 }}>
                <Table.Summary.Cell index={0}>جمع ({both.length} شخص)</Table.Summary.Cell>
                <Table.Summary.Cell index={1} />
                <Table.Summary.Cell index={2} />
                <Table.Summary.Cell index={3} align="right">{money(bothTotal, true)}</Table.Summary.Cell>
                <Table.Summary.Cell index={4}>{netState(bothTotal)}</Table.Summary.Cell>
                <Table.Summary.Cell index={5} />
              </Table.Summary.Row>
            )}
          />
        </Card>
      ) : null}
    </NeedCompany>
  );
}
