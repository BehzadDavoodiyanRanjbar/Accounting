import { describe, expect, it } from 'vitest';
import { faToEn, isValidIban, isValidNationalCode, matchPerson, normName, parseAmount, parseJalaliDate, parsePeriod, roundHalfUp, similarity, toRial } from './normalize';
import { sha256Text } from './sha256';

describe('نرمال‌سازی ارقام و مبلغ', () => {
  it('ارقام فارسی و عربی-هندی', () => {
    expect(faToEn('۱۲۳٤٥٦')).toBe('123456');
  });
  it('مبلغ با جداکنندهٔ هزارگان', () => {
    expect(parseAmount('۱٬۲۳۴٬۵۶۷')).toBe(1234567);
    expect(parseAmount('1,234,567')).toBe(1234567);
    expect(parseAmount('1.234.567')).toBe(1234567);
    expect(parseAmount('۱٬۲۳۴٫۵')).toBe(1234.5);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
  it('گرد کردن نیم به بالا و تبدیل واحد', () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(toRial(100, 'toman')).toBe(1000);
    expect(() => toRial(100, 'unknown')).toThrow();
  });
});

describe('تاریخ شمسی', () => {
  it('«١٤٠٥/٠٨/١٦» ← 2026-11-07', () => {
    expect(parseJalaliDate('١٤٠٥/٠٨/١٦')?.iso).toBe('2026-11-07');
    expect(parseJalaliDate('1405-08-16')?.j).toBe('1405/08/16');
    expect(parseJalaliDate('۱۶ آبان ۱۴۰۵')?.iso).toBe('2026-11-07');
  });
  it('تاریخ ناممکن رد می‌شود', () => {
    expect(parseJalaliDate('1405/13/01')).toBeNull();
    expect(parseJalaliDate('1405/07/31')).toBeNull();
    expect(parseJalaliDate('1404/12/30')).toBeNull();
    expect(parseJalaliDate('1403/12/30')?.j).toBe('1403/12/30');
  });
  it('دورهٔ حقوق', () => {
    expect(parsePeriod('آبان ۱۴۰۵')).toBe('1405/08');
    expect(parsePeriod('1405/8')).toBe('1405/08');
  });
});

describe('نام، شبا و کد ملی', () => {
  it('«علي رضايي» با «علی رضایی» یکی است', () => {
    expect(normName('علي رضايي')).toBe(normName('علی رضایی'));
    expect(matchPerson({ name: 'علي رضايي' }, [{ key: 'a', name: 'علی رضایی' }])?.how).toBe('exact');
  });
  it('تطبیق تقریبی هرگز خودکار تأیید نمی‌شود', () => {
    const m = matchPerson({ name: 'علی رضایی نژاد' }, [{ key: 'a', name: 'علی رضایی‌نژاد ا' }]);
    expect(similarity('محمد حسینی', 'محمد حسینی')).toBe(1);
    if (m) expect(m.auto).toBe(false);
  });
  it('تطبیق با کد ملی', () => {
    const m = matchPerson({ name: 'ناشناس', nationalCode: '۰۰۱۲۳۴۵۶۷۹' }, [{ key: 'z', name: 'کس دیگر', nationalCode: '0012345679' }]);
    expect(m?.how).toBe('nationalCode');
  });
  it('شبا: رقم کنترل mod-97', () => {
    expect(isValidIban('IR062960000000100324200001')).toBe(true);
    expect(isValidIban('IR062960000000100324200002')).toBe(false);
    expect(isValidIban('IR12')).toBe(false);
  });
  it('کد ملی: رقم کنترل', () => {
    expect(isValidNationalCode('0012345679')).toBe(true);
    expect(isValidNationalCode('0012345678')).toBe(false);
    expect(isValidNationalCode('1111111111')).toBe(false);
  });
});

describe('SHA-256', () => {
  it('بردارهای استاندارد', () => {
    expect(sha256Text('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Text('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
