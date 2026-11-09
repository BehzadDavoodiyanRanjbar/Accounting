import { Spin } from 'antd';
import { useState } from 'react';

/**
 * نمایش یک بخش از نسخهٔ فعلی (/app) داخل قالب جدید.
 * فقط برای بخش‌هایی که هنوز به کد جدید منتقل نشده‌اند. داده‌ها و نشست مشترک است.
 */
export function LegacyFramePage({ view, company }: { view: string; company: string }) {
  const [loaded, setLoaded] = useState(false);
  const src = `/app?embed=1&view=${encodeURIComponent(view)}&co=${encodeURIComponent(company)}`;
  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 64px - 32px - 46px)', minHeight: 480 }}>
      {!loaded ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin />
        </div>
      ) : null}
      <iframe
        key={`${view}:${company}`}
        title={view}
        src={src}
        onLoad={() => setLoaded(true)}
        style={{ width: '100%', height: '100%', border: 0, background: 'transparent', opacity: loaded ? 1 : 0 }}
      />
    </div>
  );
}
