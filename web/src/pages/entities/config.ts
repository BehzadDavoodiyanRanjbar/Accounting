/** تعریف فیلدها و ستون‌های هر نوع اطلاعات پایه (همان فیلدهای نسخهٔ فعلی برنامه) */
export type FieldKind = 'text' | 'textarea' | 'select' | 'group' | 'subgroup' | 'unit';

export interface Field {
  name: string;
  label: string;
  kind?: FieldKind;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  /** ۱۲ = نیم‌عرض، ۲۴ = تمام‌عرض (روی دسکتاپ) */
  span?: 12 | 24;
}

export interface ColumnSpec {
  name: string;
  label: string;
  kind?: 'group' | 'subgroup';
  width?: number;
}

export interface EntityConfig {
  sheet: 'Customers' | 'Suppliers' | 'Products' | 'Services';
  listKey: 'customers' | 'suppliers' | 'products' | 'services';
  idKey: string;
  title: string;
  subtitle?: string;
  newLabel: string;
  noun: string;
  columns: ColumnSpec[];
  fields: Field[];
  hint?: string;
  autoCode?: boolean;
  nameField: string;
}

const personType4 = [
  { value: '1', label: 'حقیقی' },
  { value: '2', label: 'حقوقی' },
  { value: '3', label: 'مشارکت مدنی' },
  { value: '4', label: 'اتباع غیرایرانی' },
];

export const ENTITIES: Record<string, EntityConfig> = {
  Customers: {
    sheet: 'Customers',
    listKey: 'customers',
    idKey: 'CustomerID',
    title: 'مشتریان (خریداران)',
    newLabel: 'مشتری جدید',
    noun: 'مشتری',
    nameField: 'Name',
    autoCode: true,
    columns: [
      { name: 'Name', label: 'نام', width: 220 },
      { name: 'CustomerCode', label: 'کد', width: 110 },
      { name: 'EconomicCode', label: 'کد اقتصادی', width: 150 },
      { name: 'NationalID', label: 'شناسه/شماره ملی', width: 160 },
      { name: 'Phone', label: 'تلفن', width: 130 },
      { name: 'City', label: 'شهر', width: 120 },
    ],
    fields: [
      { name: 'Name', label: 'نام مشتری', required: true },
      { name: 'CustomerCode', label: 'کد مشتری (خودکار؛ در صورت خالی بودن ساخته می‌شود)' },
      { name: 'PersonType', label: 'نوع شخص', kind: 'select', options: personType4 },
      { name: 'EconomicCode', label: 'کد اقتصادی (۱۱ یا ۱۴ رقم)' },
      { name: 'NationalID', label: 'شناسه ملی / شماره ملی / کد فراگیر' },
      { name: 'RegNo', label: 'شماره ثبت' },
      { name: 'PassportNo', label: 'شماره گذرنامه' },
      { name: 'BranchCode', label: 'کد شعبه' },
      { name: 'PostalCode', label: 'کد پستی' },
      { name: 'Province', label: 'استان' },
      { name: 'City', label: 'شهر' },
      { name: 'Phone', label: 'تلفن' },
      { name: 'Mobile', label: 'موبایل' },
      { name: 'Address', label: 'نشانی', kind: 'textarea', span: 24 },
      { name: 'Notes', label: 'توضیحات', kind: 'textarea', span: 24 },
    ],
  },
  Suppliers: {
    sheet: 'Suppliers',
    listKey: 'suppliers',
    idKey: 'SupplierID',
    title: 'فروشندگان',
    newLabel: 'فروشندهٔ جدید',
    noun: 'فروشنده',
    nameField: 'Name',
    autoCode: true,
    columns: [
      { name: 'Name', label: 'نام', width: 220 },
      { name: 'SupplierCode', label: 'کد', width: 110 },
      { name: 'NationalID', label: 'شناسه ملی', width: 150 },
      { name: 'Phone', label: 'تلفن', width: 130 },
      { name: 'City', label: 'شهر', width: 120 },
    ],
    fields: [
      { name: 'Name', label: 'نام فروشنده', required: true },
      { name: 'PersonType', label: 'نوع شخص', kind: 'select', options: [{ value: 'حقیقی', label: 'حقیقی' }, { value: 'حقوقی', label: 'حقوقی' }] },
      { name: 'SupplierCode', label: 'کد فروشنده (خودکار)' },
      { name: 'TradeName', label: 'نام تجاری' },
      { name: 'CompanyName', label: 'نام شرکت' },
      { name: 'NationalID', label: 'شناسه ملی' },
      { name: 'EconomicCode', label: 'کد اقتصادی' },
      { name: 'RegNo', label: 'شماره ثبت' },
      { name: 'IdCardNo', label: 'شماره شناسنامه' },
      { name: 'NationalCode', label: 'کد ملی' },
      { name: 'Phone', label: 'تلفن' },
      { name: 'Mobile', label: 'موبایل' },
      { name: 'Email', label: 'ایمیل' },
      { name: 'Province', label: 'استان' },
      { name: 'City', label: 'شهر' },
      { name: 'PostalCode', label: 'کد پستی' },
      { name: 'AccountNo', label: 'شماره حساب' },
      { name: 'Sheba', label: 'شبا' },
      { name: 'Bank', label: 'بانک' },
      { name: 'Address', label: 'آدرس', kind: 'textarea', span: 24 },
      { name: 'Notes', label: 'توضیحات', kind: 'textarea', span: 24 },
    ],
  },
  Products: {
    sheet: 'Products',
    listKey: 'products',
    idKey: 'ProductID',
    title: 'کالاها',
    newLabel: 'کالای جدید',
    noun: 'کالا',
    nameField: 'Name',
    autoCode: true,
    hint:
      '«موجودی فعلی» را فقط یک بار، برای کالایی که از قبل در انبار دارید، بنویسید. بعد از آن موجودی با ثبت فاکتور خرید و فروش و تولید خودکار تغییر می‌کند. اگر بهای واحد را هم بنویسید، در محاسبهٔ بهای تمام‌شدهٔ تولید (میانگین موزون) هم حساب می‌شود.',
    columns: [
      { name: 'Name', label: 'نام', width: 240 },
      { name: 'ProductCode', label: 'کد', width: 110 },
      { name: 'GroupID', label: 'گروه', kind: 'group', width: 150 },
      { name: 'SubGroupID', label: 'گروه فرعی', kind: 'subgroup', width: 150 },
      { name: 'DefaultUnit', label: 'واحد', width: 100 },
      { name: 'OpeningQty', label: 'موجودی اولیه', width: 130 },
    ],
    fields: [
      { name: 'Name', label: 'نام کالا', required: true },
      { name: 'ProductCode', label: 'کد کالا' },
      { name: 'GroupID', label: 'گروه اصلی', kind: 'group' },
      { name: 'SubGroupID', label: 'گروه فرعی', kind: 'subgroup' },
      { name: 'DefaultUnit', label: 'واحد پیش‌فرض', kind: 'unit' },
      { name: 'OpeningQty', label: 'موجودی فعلی (اول دوره) — تعداد/مقدار' },
      { name: 'OpeningCost', label: 'بهای هر واحد موجودی فعلی (ریال) — اختیاری' },
      { name: 'SstID', label: 'شناسه کالا/خدمت (۱۳ رقم) - برای فروش' },
      { name: 'VatRate', label: 'نرخ مالیات این کالا ٪ (خالی = پیش‌فرض)' },
      { name: 'Notes', label: 'توضیحات', kind: 'textarea', span: 24 },
    ],
  },
  Services: {
    sheet: 'Services',
    listKey: 'services',
    idKey: 'ServiceID',
    title: 'خدمات',
    subtitle: 'برای فاکتور پیمانکاری و فروش خدمات؛ بدون موجودی',
    newLabel: 'خدمت جدید',
    noun: 'خدمت',
    nameField: 'Name',
    columns: [
      { name: 'Name', label: 'نام خدمت', width: 240 },
      { name: 'ServiceCode', label: 'کد', width: 110 },
      { name: 'SstID', label: 'شناسه خدمت', width: 150 },
      { name: 'DefaultUnit', label: 'واحد', width: 100 },
      { name: 'VatRate', label: '٪ مالیات', width: 100 },
    ],
    fields: [
      { name: 'Name', label: 'نام خدمت', required: true },
      { name: 'ServiceCode', label: 'کد خدمت (اختیاری)' },
      { name: 'SstID', label: 'شناسه کالا/خدمت (۱۳ رقم)' },
      { name: 'DefaultUnit', label: 'واحد پیش‌فرض', kind: 'unit' },
      { name: 'VatRate', label: 'نرخ مالیات این خدمت ٪ (خالی = پیش‌فرض)' },
      { name: 'Notes', label: 'توضیحات', kind: 'textarea', span: 24 },
    ],
  },
};
