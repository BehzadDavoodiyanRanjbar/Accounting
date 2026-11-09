import { describe, expect, it } from 'vitest';
import { ENTRIES, GROUPS, canView, firstView, groupOf, isKnownView, menuKeyOf, visibleKeys } from './menu';

describe('ساختار منو', () => {
  it('شناسهٔ تکراری وجود ندارد (در بخش‌ها و در گروه‌ها)', () => {
    const k = ENTRIES.map((e) => e.key);
    expect(new Set(k).size).toBe(k.length);
    const g = GROUPS.flatMap((x) => x.keys);
    expect(new Set(g).size).toBe(g.length);
    g.forEach((x) => expect(isKnownView(x)).toBe(true));
  });
  it('«ثبت از روی اسکن» یک گزینهٔ مستقیم (بدون زیرمنو) است و زیر «خرید» نیست', () => {
    const g = GROUPS.find((x) => x.title === 'ثبت از روی اسکن');
    expect(g?.flat).toBe(true);
    expect(g?.keys).toEqual(['scan_doc']);
    expect(GROUPS.find((x) => x.title === 'خرید')?.keys).toEqual(['inv', 'invret', 'list']);
  });
  it('درست بعد از گروه «حسابداری» است', () => {
    const t = GROUPS.map((x) => x.title);
    expect(t[t.indexOf('حسابداری') + 1]).toBe('ثبت از روی اسکن');
  });
  it('شناسهٔ قدیمی scan هنوز معتبر است، منو ندارد و همان گزینه را برجسته می‌کند', () => {
    expect(isKnownView('scan')).toBe(true);
    expect(groupOf('scan')).toBeUndefined();
    expect(menuKeyOf('scan')).toBe('scan_doc');
    expect(menuKeyOf('inv')).toBe('inv');
  });
  it('برای کاربر شرکت هم دیده می‌شود', () => {
    expect(visibleKeys(['scan_doc'], false)).toEqual(['scan_doc']);
  });
  it('کارمند فقط بخش‌های مجاز را می‌بیند و صفحه‌های مدیر شرکت/سیستم را نه', () => {
    const staff = { role: 'company', staff: true, perms: { sale: 'w', base: 'r' } };
    expect(canView('sale', staff)).toBe(true);
    expect(canView('sales', staff)).toBe(true);
    expect(canView('Customers', staff)).toBe(true);
    expect(canView('inv', staff)).toBe(false);
    expect(canView('ac_new', staff)).toBe(false);
    expect(canView('dash', staff)).toBe(false);
    for (const k of ['set', 'imp', 'Companies', 'portal_acc', 'co_users', 'users', 'restore']) expect(canView(k, staff)).toBe(false);
    expect(firstView(staff)).toBe('sale');
  });
  it('مدیر شرکت همه‌چیز جز بخش‌های مدیر سیستم را دارد و فقط او «کاربران شرکت» را می‌بیند', () => {
    const owner = { role: 'company', owner: true, perms: {} };
    expect(canView('co_users', owner)).toBe(true);
    expect(canView('set', owner)).toBe(true);
    expect(canView('users', owner)).toBe(false);
    expect(canView('co_users', { role: 'admin' })).toBe(false);
    expect(canView('users', { role: 'admin' })).toBe(true);
    expect(visibleKeys(['users', 'restore', 'set'], { role: 'company', owner: true })).toEqual(['set']);
  });
  it('هر صفحهٔ منو برای کارمند یا در جدول بخش‌ها هست یا فقط مدیر', () => {
    const all = { role: 'company', staff: true, perms: { dash: 'w', base: 'w', buy: 'w', sale: 'w', stock: 'w', prod: 'w', bank: 'w', acc: 'w', cs: 'w', scan: 'w' } };
    const hidden = GROUPS.flatMap((g) => g.keys).filter((k) => !canView(k, all)).sort();
    expect(hidden).toEqual(['Companies', 'co_users', 'imp', 'portal_acc', 'restore', 'set', 'users']);
  });
});
