import { SwapOutlined, UndoOutlined } from '@ant-design/icons';
import { App, Button, Select, Space, Typography } from 'antd';
import { useMemo, useRef, useState } from 'react';
import { errorMessage } from '../../api/client';
import { csCall } from '../../api/costService';
import { useCompany } from '../../api/CompanyContext';
import { CrudPage } from '../../kit/CrudPage';
import { fmtNum, str, todayJalali } from '../../kit/format';
import { useCostCfg, useCsQuery, useKindActions, useKindList } from '../../kit/hooks';
import { PreviewBox } from '../../kit/PreviewBox';
import { RecordDrawer } from '../../kit/RecordDrawer';
import type { ColSpec, FormSpec, Row } from '../../kit/types';
import { contractOpts, labelOf, productOpts } from './helpers';

interface Lots {
  rows: Array<{ ItemID: string; InvoiceNo: string; DateJalali: string; Avail: string | number; Qty: string | number }>;
  balance: string | number;
}

/** حوالهٔ مصرف مواد و مصالح (ثبت، برگشت به انبار، انتقال به قرارداد دیگر) */
export default function IssuesPage() {
  const { company } = useCompany();
  const { message, notification } = App.useApp();
  const cfg = useCostCfg();
  const act = useKindActions('issue');
  const [contract, setContract] = useState('');
  const list = useKindList<Row>('issue', { contract });
  const [lotProduct, setLotProduct] = useState('');
  const lots = useCsQuery<Lots>('csLots', { product: lotProduct }, !!lotProduct);
  // گزینه‌های لات از ref خوانده می‌شود تا بعد از باز شدن فرم هم با تغییر کالا به‌روز شود
  const lotsRef = useRef<Lots | undefined>(undefined);
  lotsRef.current = lots.data;
  const [rt, setRt] = useState<{ row: Row; kind: 'return' | 'transfer' } | null>(null);
  const [rtOpen, setRtOpen] = useState(false);
  const [rtBusy, setRtBusy] = useState(false);

  const o = cfg.data?.options;
  const cts = contractOpts(cfg.data, false);
  const rows = list.data?.rows ?? [];
  const ik = o?.ik as Record<string, string> | undefined;
  const isrc = o?.isrc as Record<string, string> | undefined;

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'No', label: 'شماره', get: (r) => str(r.No), width: 100 },
      { id: 'DateJalali', label: 'تاریخ', get: (r) => str(r.DateJalali), width: 110 },
      { id: 'Kind', label: 'نوع', get: (r) => `${labelOf(ik, r.Kind)}${r.Kind === 'issue' ? ` (${r.Source === 'direct' ? 'خرید مستقیم' : 'انبار'})` : ''}`, width: 170 },
      { id: 'Contract', label: 'قرارداد', get: (r) => `${str(r.ContractNo)}${r.ToContractNo ? ` ← ${str(r.ToContractNo)}` : ''}`, width: 130 },
      { id: 'ProductName', label: 'کالا', get: (r) => str(r.ProductName), width: 200 },
      { id: 'Qty', label: 'مقدار', get: (r) => `${str(r.Qty)} ${str(r.Unit)}`, width: 120 },
      { id: 'AbnormalQty', label: 'غیرعادی', get: (r) => (Number(r.AbnormalQty) > 0 ? str(r.AbnormalQty) : ''), width: 100 },
      { id: 'Amount', label: 'بها (ریال)', get: (r) => Number(String(r.Amount).replace(/,/g, '')) || 0, type: 'number', width: 140 },
      { id: 'Formula', label: 'فرمول', get: (r) => str(r.Formula), width: 240 },
    ],
    [ik],
  );

  const issueObj = (v: Row): Row => ({
    Kind: 'issue',
    ContractID: str(v.ContractID),
    DateJalali: str(v.DateJalali),
    ProductID: str(v.ProductID),
    Source: str(v.Source),
    ItemID: str(v.ItemID),
    Qty: str(v.Qty),
    AbnormalQty: str(v.AbnormalQty),
    Installed: !!v.Installed,
    Description: str(v.Description),
  });

  const buildForm = (): FormSpec => ({
    title: 'حوالهٔ مصرف مواد',
    fields: [
      { name: 'ContractID', label: 'قرارداد', type: 'select', required: true, options: cts, span: 12 },
      { name: 'DateJalali', label: 'تاریخ', type: 'date', required: true, span: 12 },
      { name: 'ProductID', label: 'کالا', type: 'select', required: true, options: productOpts(cfg.data), span: 12 },
      { name: 'Source', label: 'منبع', type: 'select', required: true, options: Object.entries(isrc ?? {}).map(([value, label]) => ({ value, label })), span: 12 },
      {
        name: 'ItemID',
        label: 'لات (ردیف فاکتور خرید)',
        type: 'select',
        span: 24,
        placeholder: '— (روش ارزشیابی قرارداد) —',
        options: () => (lotsRef.current?.rows ?? []).map((l) => ({ value: l.ItemID, label: `فاکتور ${l.InvoiceNo} (${l.DateJalali}) — باقیمانده لات ${l.Avail} از ${l.Qty}` })),
        help: '«شناسایی ویژه» یا «خرید مستقیم» لات را لازم دارد.',
      },
      { name: 'Qty', label: 'مقدار', type: 'number', required: true, span: 12 },
      { name: 'AbnormalQty', label: 'ضایعات غیرعادی (از همین مقدار)', type: 'number', span: 12 },
      { name: 'Installed', label: 'مصالح نصب‌شده است (برای محاسبهٔ پیشرفت در مرحله‌های بعد)', type: 'check' },
      { name: 'Description', label: 'توضیحات', span: 24 },
    ],
    initial: { DateJalali: todayJalali(), ContractID: contract || undefined, Source: 'stock', Installed: true },
  });

  const preview = (v: Row) => (
    <div style={{ marginTop: 8 }}>
      {lotProduct && lots.data ? <Typography.Paragraph type="secondary">موجودی کل انبار: {str(lots.data.balance)}</Typography.Paragraph> : null}
      <PreviewBox
        run={async () => {
          const r = await csCall<Row>('csIssuePreview', company, { obj: issueObj(v) });
          return (
            <div>
              <b>
                بها: {fmtNum(r.Amount)} ریال (هر واحد {fmtNum(r.UnitCost)})
              </b>
              {r.AbnormalAmount ? <div>از آن غیرعادی (هزینهٔ دوره): {fmtNum(r.AbnormalAmount)}، جزو بهای خدمات: {fmtNum(r.NormalAmount)}</div> : null}
              <div>{str(r.Formula)}</div>
            </div>
          );
        }}
      />
    </div>
  );

  const submitRt = async (v: Row) => {
    if (!rt) return;
    setRtBusy(true);
    try {
      const r = await csCall<Row>('csSave', company, {
        kind: 'issue',
        obj: { Kind: rt.kind, ContractID: str(rt.row.ContractID), RefIssueID: str(rt.row.IssueID), DateJalali: str(v.DateJalali), Qty: str(v.Qty), ToContractID: rt.kind === 'transfer' ? str(v.ToContractID) : '' },
      });
      message.success(`ثبت شد. بها: ${fmtNum(r.Amount)}`);
      setRtOpen(false);
      await act.refresh();
    } catch (e) {
      notification.error({ message: 'ثبت انجام نشد', description: errorMessage(e) });
    } finally {
      setRtBusy(false);
    }
  };

  const rtInitial = useMemo(() => ({ DateJalali: todayJalali() }), [rt]); // eslint-disable-line react-hooks/exhaustive-deps

  const openRt = (row: Row, kind: 'return' | 'transfer') => {
    setRt({ row, kind });
    setRtOpen(true);
  };

  return (
    <>
      <CrudPage<Row>
        title="حوالهٔ مصرف مواد و مصالح"
        hint="مواد مصرفی هر قرارداد از موجودی انبار (یا خرید مستقیم برای قرارداد) برداشت می‌شود. بهای حواله هنگام ثبت با روش ارزشیابی همان قرارداد (میانگین موزون / FIFO / شناسایی ویژه) محاسبه و قطعی می‌شود؛ حوالهٔ ثبت‌شده ویرایش نمی‌شود (برای اصلاح: برگشت یا انتقال ثبت کنید، یا آخرین حوالهٔ همان کالا را حذف کنید). ضایعات غیرعادی طبق قاعدهٔ «تنظیمات»، هزینهٔ دوره می‌شود. [نیازمند تأیید: تعریف ضایعات غیرعادی طبق استاندارد]"
        rows={rows}
        loading={list.isFetching}
        error={list.isError ? errorMessage(list.error) : null}
        onReload={() => void list.refetch()}
        cols={cols}
        getId={(r) => str(r.IssueID)}
        nameOf={(r) => `حواله ${str(r.No)}`}
        filters={
          <Space>
            <span>قرارداد</span>
            <Select style={{ minWidth: 280 }} allowClear showSearch optionFilterProp="label" placeholder="همه" value={contract || undefined} options={cts} onChange={(v) => setContract(v ?? '')} />
          </Space>
        }
        newButtons={[{ label: 'حوالهٔ مصرف جدید' }]}
        buildForm={buildForm}
        onSave={async (v) => {
          const r = await act.save(issueObj(v));
          message.success(`حواله ثبت شد. بها: ${fmtNum(r.Amount)}`);
        }}
        onDelete={(r) => act.remove(str(r.IssueID))}
        canEdit={() => false}
        rowActions={(r) =>
          r.Kind === 'issue' ? (
            <>
              <Button size="small" icon={<UndoOutlined />} onClick={() => openRt(r, 'return')}>
                برگشت
              </Button>
              <Button size="small" icon={<SwapOutlined />} onClick={() => openRt(r, 'transfer')}>
                انتقال
              </Button>
            </>
          ) : null
        }
        actionsWidth={260}
        drawerExtra={preview}
        onDrawerChange={(v) => setLotProduct(str(v.ProductID))}
        defaultSort={{ id: 'DateJalali', desc: true }}
        storageKey="mt_v2_cols_cs_is"
      />
      <RecordDrawer
        open={rtOpen}
        title={rt ? `${rt.kind === 'return' ? 'برگشت به انبار' : 'انتقال به قرارداد دیگر'} — حواله ${str(rt.row.No)}` : ''}
        fields={[
          { name: 'DateJalali', label: 'تاریخ', type: 'date', required: true, span: 12 },
          { name: 'Qty', label: 'مقدار', type: 'number', required: true, span: 12 },
          ...(rt?.kind === 'transfer'
            ? [{ name: 'ToContractID', label: 'قرارداد مقصد', type: 'select' as const, required: true, options: cts.filter((c) => c.value !== str(rt.row.ContractID)), span: 24 as const }]
            : []),
        ]}
        initial={rtInitial}
        saving={rtBusy}
        width={520}
        note={rt ? `${str(rt.row.ProductName)} — مقدار حواله ${str(rt.row.Qty)} (برگشت/انتقال فقط از بخش «عادی» حواله و با همان بهای حواله انجام می‌شود).` : undefined}
        onClose={() => setRtOpen(false)}
        onSubmit={submitRt}
      />
    </>
  );
}
