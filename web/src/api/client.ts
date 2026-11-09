/**
 * کلاینت API — همان قرارداد سرور فعلی: POST /api با بدنهٔ { t: توکن, a: عملیات, p: پارامترها }
 * پاسخ: { ok: true, data } یا { ok: false, error }
 * توکن نشست را صفحهٔ ورود فعلی (landing) در sessionStorage/localStorage با کلید mt_token ذخیره می‌کند.
 */

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export function getToken(): string {
  try {
    return sessionStorage.getItem('mt_token') || localStorage.getItem('mt_token') || '';
  } catch {
    return '';
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem('mt_token');
    localStorage.removeItem('mt_token');
  } catch {
    /* ignore */
  }
}

/** ذخیرهٔ توکن جدید (پس از تغییر رمز)؛ remember=true یعنی «مرا به خاطر بسپار» */
export function setToken(t: string, remember: boolean): void {
  try {
    clearToken();
    (remember ? localStorage : sessionStorage).setItem('mt_token', t);
  } catch {
    /* ignore */
  }
}

export function goLogin(): void {
  clearToken();
  window.location.replace('/');
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function callApi<T>(action: string, params: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
  const res = await fetch('/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ t: getToken(), a: action, p: params }),
    signal,
  });
  if (!res.ok) throw new ApiError(`خطای ارتباط با سرور (${res.status})`, 'HTTP');
  const body = (await res.json()) as Envelope<T>;
  if (!body.ok) {
    if (body.error === 'NEEDCODE' || body.error === 'MUSTCHANGE') {
      goLogin();
      throw new ApiError('نشست شما به پایان رسیده است؛ دوباره وارد شوید.', body.error);
    }
    throw new ApiError(body.error ?? 'خطای نامشخص', body.error);
  }
  return body.data as T;
}

/** متن قابل‌نمایش برای هر خطا */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.name === 'AbortError' ? '' : e.message;
  return 'خطای نامشخص';
}
