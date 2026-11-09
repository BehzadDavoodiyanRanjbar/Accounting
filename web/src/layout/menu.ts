/**
 * فهرست یکپارچهٔ بخش‌های برنامه (همان فهرست نسخهٔ فعلی).
 * هر بخش یک شناسهٔ ثابت دارد (مثلاً inv، cs_ct). آدرس‌ها: /p/<شناسه>
 * بخش‌هایی که هنوز به کد جدید منتقل نشده‌اند، داخل همین قالب با نسخهٔ فعلی نمایش داده می‌شوند.
 */
export interface MenuEntry {
  key: string;
  label: string;
}
export interface MenuGroup {
  title: string;
  keys: string[];
  /** گروه تک‌بخشی که در منو به‌صورت یک گزینهٔ مستقیم (بدون زیرمنو) نمایش داده می‌شود */
  flat?: boolean;
}

export const ENTRIES: MenuEntry[] = [
  { key: 'dash', label: 'داشبورد' },
  { key: 'inv', label: 'ثبت فاکتور خرید' },
  { key: 'invret', label: 'ثبت برگشت از خرید' },
  { key: 'scan_doc', label: 'ثبت از روی اسکن' },
  /** نام قدیمی: همان صفحهٔ «ثبت از روی اسکن» با تب «سایر اسناد (خرید)»؛ فقط برای کار کردن پیوندهای قدیمی */
  { key: 'scan', label: 'ثبت از روی اسکن (اسناد خرید)' },
  { key: 'list', label: 'فاکتورهای خرید' },
  { key: 'sale', label: 'ثبت فاکتور فروش' },
  { key: 'sales', label: 'فاکتورهای فروش' },
  { key: 'portal_acc', label: 'حساب‌های پنل مشتری' },
  { key: 'po', label: 'سفارش‌های تولید' },
  { key: 'rcp', label: 'فرمول‌های ساخت' },
  { key: 'exp', label: 'فاکتور هزینه (سربار)' },
  { key: 'pcfg', label: 'تنظیمات تولید' },
  { key: 'stock', label: 'موجودی مواد اولیه و کالا' },
  { key: 'mg', label: 'کالای ساخته‌شده' },
  { key: 'acc', label: 'گزارش حساب فروشندگان و خریداران' },
  { key: 'bk_bank', label: 'بانک‌ها' },
  { key: 'bk_cash', label: 'صندوق‌ها' },
  { key: 'bk_imp', label: 'تنخواه‌گردان‌ها' },
  { key: 'bk_trf', label: 'انتقال' },
  { key: 'bk_trl', label: 'لیست انتقال‌ها' },
  { key: 'bk_chi', label: 'لیست چک‌های دریافتی' },
  { key: 'bk_cho', label: 'لیست چک‌های پرداختی' },
  { key: 'ac_new', label: 'سند حسابداری جدید' },
  { key: 'ac_list', label: 'لیست اسناد حسابداری' },
  { key: 'ac_tbl', label: 'جدول حساب‌ها' },
  { key: 'ac_dim', label: 'تفصیلی / کارکنان / پروژه' },
  { key: 'ac_tb', label: 'تراز آزمایشی' },
  { key: 'ac_led', label: 'دفتر معین' },
  { key: 'ac_fy', label: 'سال مالی و بستن حساب‌ها' },
  { key: 'cs_ct', label: 'قراردادها' },
  { key: 'cs_cc', label: 'قراردادهای هزینه‌ای' },
  { key: 'cs_mc', label: 'ماشین‌آلات و تجهیزات' },
  { key: 'cs_is', label: 'حواله مصرف مواد' },
  { key: 'cs_pay', label: 'دستمزد (حقوق و ساعت کار)' },
  { key: 'cs_st', label: 'صورت‌وضعیت پیمانکار' },
  { key: 'cs_ml', label: 'کارکرد و هزینه ماشین‌آلات' },
  { key: 'cs_mob', label: 'تجهیز و برچیدن کارگاه' },
  { key: 'cs_oh', label: 'سربار و تسهیم' },
  { key: 'cs_est', label: 'برآورد تکمیل و پیشرفت' },
  { key: 'cs_prog', label: 'درآمد و بهای خدمات ارائه‌شده' },
  { key: 'cs_post', label: 'صدور سند و گزارش جامع (مرحله ۶)' },
  { key: 'cs_lg', label: 'دفتر هزینه و کارت قرارداد' },
  { key: 'cs_cf', label: 'تنظیمات بهای خدمات' },
  { key: 'rp_hub', label: 'تمام گزارش‌ها' },
  { key: 'Customers', label: 'مشتریان' },
  { key: 'Suppliers', label: 'فروشندگان' },
  { key: 'Products', label: 'کالاها' },
  { key: 'Services', label: 'خدمات' },
  { key: 'groups', label: 'گروه‌ها و واحدها' },
  { key: 'imp', label: 'ورود از Excel' },
  { key: 'Companies', label: 'شرکت‌ها/مشتریان' },
  { key: 'users', label: 'کاربران' },
  { key: 'co_users', label: 'کاربران شرکت (کارکنان)' },
  { key: 'set', label: 'تنظیمات و پشتیبان' },
  { key: 'restore', label: 'بازگردانی پشتیبان' },
];

export const GROUPS: MenuGroup[] = [
  { title: 'خرید', keys: ['inv', 'invret', 'list'] },
  { title: 'فروش', keys: ['sale', 'sales', 'portal_acc'] },
  { title: 'بانکداری', keys: ['bk_bank', 'bk_cash', 'bk_imp', 'bk_trf', 'bk_trl', 'bk_chi', 'bk_cho'] },
  { title: 'حسابداری', keys: ['ac_new', 'ac_list', 'ac_tbl', 'ac_dim', 'ac_tb', 'ac_led', 'ac_fy'] },
  { title: 'ثبت از روی اسکن', keys: ['scan_doc'], flat: true },
  { title: 'گزارش‌ها', keys: ['rp_hub'] },
  { title: 'تولید', keys: ['po', 'rcp', 'exp', 'pcfg'] },
  { title: 'بهای تمام‌شده خدمات', keys: ['cs_ct', 'cs_cc', 'cs_mc', 'cs_is', 'cs_pay', 'cs_st', 'cs_ml', 'cs_mob', 'cs_oh', 'cs_est', 'cs_prog', 'cs_post', 'cs_lg', 'cs_cf'] },
  { title: 'انبار و گزارش‌ها', keys: ['stock', 'mg', 'acc'] },
  { title: 'اطلاعات پایه', keys: ['Customers', 'Suppliers', 'Products', 'Services', 'groups', 'Companies'] },
  { title: 'سیستم', keys: ['imp', 'users', 'co_users', 'set', 'restore'] },
];

const BY_KEY = new Map(ENTRIES.map((e) => [e.key, e]));

export const isKnownView = (key: string) => BY_KEY.has(key);

/** برچسب بخش برای کاربر؛ کاربر غیرمدیر برای دو بخش نام متفاوت می‌بیند (مثل نسخهٔ فعلی) */
export function labelOf(key: string, isAdmin: boolean): string {
  if (!isAdmin && key === 'Companies') return 'پروفایل شرکت';
  if (!isAdmin && key === 'set') return 'تنظیمات و پشتیبان';
  return BY_KEY.get(key)?.label ?? key;
}

/** اطلاعات دسترسی کاربر فعلی (از Me) */
export interface Access {
  role?: string;
  owner?: boolean;
  staff?: boolean;
  perms?: Record<string, string>;
}

/** بخش دسترسیِ هر صفحه برای کارکنان (هم‌نام با بخش‌های سرور: dash, base, buy, sale, stock, prod, bank, acc, cs, scan) */
const SECTION_OF: Record<string, string> = {
  dash: 'dash',
  inv: 'buy', invret: 'buy', list: 'buy', scan: 'buy',
  scan_doc: 'scan',
  sale: 'sale', sales: 'sale',
  po: 'prod', rcp: 'prod', exp: 'prod', pcfg: 'prod',
  stock: 'stock', mg: 'stock', acc: 'stock',
  bk_bank: 'bank', bk_cash: 'bank', bk_imp: 'bank', bk_trf: 'bank', bk_trl: 'bank', bk_chi: 'bank', bk_cho: 'bank',
  ac_new: 'acc', ac_list: 'acc', ac_tbl: 'acc', ac_dim: 'acc', ac_tb: 'acc', ac_led: 'acc', ac_fy: 'acc', rp_hub: 'acc',
  cs_ct: 'cs', cs_cc: 'cs', cs_mc: 'cs', cs_is: 'cs', cs_pay: 'cs', cs_st: 'cs', cs_ml: 'cs', cs_mob: 'cs', cs_oh: 'cs', cs_est: 'cs', cs_prog: 'cs', cs_post: 'cs', cs_lg: 'cs', cs_cf: 'cs',
  Customers: 'base', Suppliers: 'base', Products: 'base', Services: 'base', groups: 'base',
};
const ADMIN_ONLY = new Set(['users', 'restore']);
/** فقط مدیر شرکت (و مدیر سیستم) */
const OWNER_ONLY = new Set(['portal_acc', 'imp', 'Companies', 'set']);

const toAccess = (a: Access | boolean | undefined): Access => (typeof a === 'boolean' ? { role: a ? 'admin' : 'company' } : (a ?? {}));

/** آیا کاربر می‌تواند این صفحه را ببیند؟ (اعمال واقعی دسترسی سمت سرور است؛ این فقط منو و صفحه را مرتب می‌کند) */
export function canView(key: string, access?: Access | boolean): boolean {
  const a = toAccess(access);
  if (a.role === 'admin') return key !== 'co_users';
  if (ADMIN_ONLY.has(key)) return false;
  if (key === 'co_users') return a.owner !== false && !a.staff;
  if (!a.staff) return true;
  if (OWNER_ONLY.has(key)) return false;
  const sec = SECTION_OF[key];
  return !!sec && !!a.perms?.[sec];
}

export const visibleKeys = (keys: string[], access?: Access | boolean) => keys.filter((k) => canView(k, access));

/** اولین صفحهٔ مجاز (برای کارمندی که به داشبورد دسترسی ندارد) */
export function firstView(access?: Access | boolean): string | undefined {
  if (canView('dash', access)) return 'dash';
  return GROUPS.flatMap((g) => g.keys).find((k) => canView(k, access));
}

/** شناسهٔ گروهِ هر بخش (برای باز شدن خودکار گروه در منو) */
export const groupOf = (key: string) => GROUPS.find((g) => g.keys.includes(key));

/** شناسهٔ قدیمی scan همان صفحهٔ جدید است؛ در منو همان گزینهٔ «ثبت از روی اسکن» برجسته می‌شود */
export const menuKeyOf = (key: string) => (key === 'scan' ? 'scan_doc' : key);
