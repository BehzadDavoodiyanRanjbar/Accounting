export interface Me {
  id: string;
  username: string;
  fullName: string;
  role: string;
  companyId: string;
  companyName: string;
  /** مدیر شرکت (کاربر اصلی) */
  owner?: boolean;
  /** کارمندِ دعوت‌شده با دسترسی محدود */
  staff?: boolean;
  staffRole?: string;
  /** بخش ← r (مشاهده) | w (ویرایش) */
  perms?: Record<string, 'r' | 'w'>;
}

export interface Company {
  CompanyID: string;
  Name: string;
  IsActive?: boolean | string;
  [k: string]: unknown;
}

/** یک رکورد اطلاعات پایه (مشتری، فروشنده، کالا، ...)؛ فیلدها به نوع رکورد بستگی دارد */
export type EntityRow = Record<string, unknown> & { CompanyID?: string; IsActive?: boolean };

export interface Bootstrap {
  me: Me;
  companies: Company[];
  customers?: EntityRow[];
  suppliers?: EntityRow[];
  products?: EntityRow[];
  services?: EntityRow[];
  groups?: EntityRow[];
  subs?: EntityRow[];
  units?: EntityRow[];
  /** نرخ پیش‌فرض مالیات ارزش افزوده و نرخ هر شرکت (٪) */
  vat?: number;
  vats?: Record<string, number>;
}

export interface IdName {
  id: string;
  Name: string;
  Code?: string;
  IsActive?: boolean;
}

/** نقشهٔ کد ← برچسب فارسی (مثل { active: 'فعال' }) */
export type LabelMap = Record<string, string>;

export interface CostElement {
  ElemID: string;
  Code: string;
  Name: string;
  Grp: string;
  Treat: string;
  AccKey?: string;
  Src?: string;
  Verify?: boolean;
  IsActive: boolean;
  IsSystem?: boolean;
  Notes?: string;
}
export interface CostBase {
  BaseID: string;
  Code: string;
  Name: string;
  Src?: string;
  Verify?: boolean;
  IsActive: boolean;
  IsSystem?: boolean;
}
export interface CostRule {
  RuleID: string;
  Label: string;
  Value: string;
  Kind: string;
  Src?: string;
  Verify?: boolean;
  Locked?: boolean;
  Opts?: Array<{ v: string; t: string }>;
}

export interface CostOptions {
  projects: IdName[];
  customers: IdName[];
  suppliers: IdName[];
  machines: Array<{ id: string; Name: string; Own: boolean }>;
  contracts: Array<{ id: string; No: string; Title: string; ValMethod?: string; Status: string }>;
  products: Array<{ id: string; Name: string; Code: string; Unit?: string }>;
  employees: Array<{ id: string; Name: string; Code: string }>;
  prog: LabelMap;
  val: LabelMap;
  mob: LabelMap;
  status: LabelMap;
  grp: LabelMap;
  treat: LabelMap;
  depr: LabelMap;
  rateUnit: LabelMap;
  src: LabelMap;
  /** برچسب‌های سایر فهرست‌ها (ohk, mht, mobk, ht, ik, ...) */
  [k: string]: unknown;
}

export interface CostConfig {
  options: CostOptions;
  elements: CostElement[];
  bases: CostBase[];
  rules: CostRule[];
}

export interface Contract {
  ContractID: string;
  No: string;
  Title: string;
  ProjID: string;
  ProjName: string;
  CustomerID: string;
  CustomerName: string;
  StartJ: string;
  EndJ: string;
  Amount: string | number;
  Status: string;
  ProgMethod: string;
  ValMethod: string;
  MobAlloc: string;
  UnitName: string;
  UnitQty: string | number;
  GaClaim: boolean | string;
  Notes: string;
  CostTotal: number;
}

export type ContractInput = Partial<Pick<Contract, 'ContractID'>> &
  Pick<Contract, 'No' | 'Title' | 'ProjID'> &
  Partial<
    Pick<
      Contract,
      'CustomerID' | 'StartJ' | 'EndJ' | 'Amount' | 'Status' | 'ProgMethod' | 'ValMethod' | 'MobAlloc' | 'UnitName' | 'UnitQty' | 'GaClaim' | 'Notes'
    >
  >;
