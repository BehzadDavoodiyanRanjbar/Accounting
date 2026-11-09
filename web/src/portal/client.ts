/** کلاینت پنل مشتری — توکن جدا از برنامهٔ اصلی (کلید mt_portal_token) تا دو نشست با هم قاطی نشوند */
export class PortalError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

const KEY = 'mt_portal_token';

export const getPToken = (): string => {
  try {
    return sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
};
export const clearPToken = (): void => {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};
export const setPToken = (t: string, remember: boolean): void => {
  clearPToken();
  try {
    (remember ? localStorage : sessionStorage).setItem(KEY, t);
  } catch {
    /* ignore */
  }
};

interface Env<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** فراخوانی API؛ withToken=false برای ورود و کپچا */
export async function pcall<T>(action: string, params: Record<string, unknown> = {}, withToken = true): Promise<T> {
  const res = await fetch('/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ t: withToken ? getPToken() : '', a: action, p: params }),
  });
  if (!res.ok) throw new PortalError(`خطای ارتباط با سرور (${res.status})`, 'HTTP');
  const body = (await res.json()) as Env<T>;
  if (!body.ok) {
    if (body.error === 'NEEDCODE') throw new PortalError('نشست شما به پایان رسیده است؛ دوباره وارد شوید.', 'NEEDCODE');
    if (body.error === 'MUSTCHANGE') throw new PortalError('ابتدا رمز عبور خود را تغییر دهید.', 'MUSTCHANGE');
    throw new PortalError(body.error ?? 'خطای نامشخص', body.error);
  }
  return body.data as T;
}

export const perr = (e: unknown): string => (e instanceof Error ? e.message : 'خطای نامشخص');
