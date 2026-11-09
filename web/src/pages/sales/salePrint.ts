import { callApi } from '../../api/client';
import type { Bootstrap } from '../../api/types';
import { str } from '../../kit/format';
import type { Row } from '../../kit/types';
import { mapLimit } from '../print/mapLimit';
import { openBlankPrintWindow, openPrintWindow, PRINT_SALE_BOOT } from '../print/legacyPrint';

interface MessageInstance {
  warning: (c: string) => unknown;
  error: (c: string) => unknown;
}

/** چاپ یک یا چند صورتحساب فروش (A4 افقی) در یک پنجره؛ قالب قبلی برنامه + کادر «توضیحات» */
export async function printSales(ids: string[], data: Bootstrap | undefined, message: MessageInstance): Promise<void> {
  const w = openBlankPrintWindow();
  if (!w) return void message.warning('پنجرهٔ چاپ مسدود شد؛ اجازهٔ باز شدن پنجره را بدهید.');
  try {
    const docs = await mapLimit(ids, 5, async (id) => {
      const r = await callApi<Row>('getSale', { id });
      const co = ((data?.companies ?? []).find((x) => x.CompanyID === str(r.CompanyID)) ?? {}) as Row;
      const cu = ((data?.customers ?? []).find((x) => str(x.CustomerID) === str(r.CustomerID)) ?? {}) as Row;
      return { r, co, cu };
    });
    openPrintWindow({ w, title: docs.length === 1 ? `صورتحساب ${str(docs[0].r.SerialNo)}` : `چاپ ${docs.length} صورتحساب`, landscape: true, data: { docs }, boot: PRINT_SALE_BOOT });
  } catch (e) {
    w.close();
    message.error(e instanceof Error ? e.message : 'چاپ انجام نشد');
  }
}

export const printSale = (id: string, data: Bootstrap | undefined, message: MessageInstance) => printSales([id], data, message);
