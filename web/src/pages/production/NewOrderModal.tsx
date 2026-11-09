import { App, Button, Checkbox, Col, Form, Input, Modal, Row as ARow, Select, Space } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { csCall } from '../../api/costService';
import { useCompany } from '../../api/CompanyContext';
import { NumInput } from '../../kit/NumInput';
import { str, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Row } from '../../kit/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** ساخت سفارش تولید جدید از روی یک «فرمول ساخت» */
export function NewOrderModal({ open, onClose }: Props) {
  const { company } = useCompany();
  const { message } = App.useApp();
  const nav = useNavigate();
  const rl = useCsQuery<{ rows: Row[] }>('recipeList', {}, open);
  const recipes = useMemo(() => (rl.data?.rows ?? []).filter((x) => x.Active), [rl.data]);
  const [rid, setRid] = useState('');
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(todayJalali());
  const [notes, setNotes] = useState('');
  const [children, setChildren] = useState(true);
  const [params, setParams] = useState<Row[]>([]);
  const [pv, setPv] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && !rid && recipes.length) setRid(str(recipes[0].RecipeID));
  }, [open, recipes, rid]);

  const rec = recipes.find((x) => x.RecipeID === rid);
  useEffect(() => {
    if (!rec) return;
    setQty(str(rec.OutputQty));
    let live = true;
    csCall<Row>('recipeGet', company, { id: rid })
      .then((r) => {
        if (!live) return;
        const ps = (r.params ?? []) as Row[];
        setParams(ps);
        setPv(Object.fromEntries(ps.map((p) => [str(p.key), str(p.default)])));
      })
      .catch((e) => message.error(errorMessage(e)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid, company]);

  const go = async () => {
    setBusy(true);
    try {
      const r = await csCall<Row>('prodCreate', company, { recipeId: rid, qty, date, params: pv, notes, children });
      message.success(`سفارش ${r.OrderNo} ساخته شد${r.children?.length ? ` (+ ${r.children.length} سفارش نیمه‌ساخته)` : ''}`);
      onClose();
      nav(`/p/po?id=${encodeURIComponent(str(r.OrderID))}`);
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (open && !rl.isLoading && !recipes.length) {
    return (
      <Modal open title="هنوز فرمول ساخت ندارید" onCancel={onClose} footer={null}>
        <p>برای ثبت سفارش تولید، اول باید برای محصول «فرمول ساخت» تعریف کنید (مواد لازم، مراحل و کنترل‌ها).</p>
        <Space>
          <Button
            type="primary"
            onClick={() => {
              onClose();
              nav('/p/rcp');
            }}
          >
            رفتن به فرمول‌های ساخت
          </Button>
          <Button onClick={onClose}>بستن</Button>
        </Space>
      </Modal>
    );
  }

  return (
    <Modal open={open} title="سفارش تولید جدید" onCancel={onClose} onOk={go} okText="ایجاد سفارش" cancelText="انصراف" confirmLoading={busy} okButtonProps={{ disabled: !rid }} width={760}>
      <Form layout="vertical">
        <ARow gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item label="فرمول ساخت (محصول)">
              <Select
                value={rid || undefined}
                loading={rl.isLoading}
                onChange={setRid}
                showSearch
                optionFilterProp="label"
                options={recipes.map((x) => ({ value: str(x.RecipeID), label: x.Product + (x.Name && x.Name !== x.Product ? ` — ${x.Name}` : '') }))}
              />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label={`مقدار تولید (${str(rec?.Unit)})`}>
              <NumInput value={qty} onChange={setQty} />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="تاریخ">
              <Input value={date} onChange={(e) => setDate(e.target.value.trim())} />
            </Form.Item>
          </Col>
        </ARow>
        {params.length ? (
          <ARow gutter={12}>
            {params.map((p) => (
              <Col key={str(p.key)} xs={12} md={6}>
                <Form.Item label={`${str(p.label || p.key)}${p.unit ? ` (${str(p.unit)})` : ''}`}>
                  <NumInput value={pv[str(p.key)] ?? ''} onChange={(v) => setPv((o) => ({ ...o, [str(p.key)]: v }))} />
                </Form.Item>
              </Col>
            ))}
          </ARow>
        ) : null}
        <Form.Item label="توضیحات">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Form.Item>
        <Checkbox checked={children} onChange={(e) => setChildren(e.target.checked)}>
          برای نیمه‌ساخته‌های کم‌موجود، خودکار سفارش جداگانه ساخته شود
        </Checkbox>
      </Form>
    </Modal>
  );
}
