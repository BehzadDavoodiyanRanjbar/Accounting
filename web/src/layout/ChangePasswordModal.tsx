import { App, Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { errorMessage, setToken } from '../api/client';
import { changeMyPassword } from '../api/costService';

interface Values {
  old: string;
  password: string;
  repeat: string;
}

/** تغییر رمز خود کاربر (همان قانون رمز نسخهٔ فعلی: حداقل ۸ کاراکتر، شامل حرف انگلیسی و عدد) */
export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm<Values>();
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      const r = await changeMyPassword(v.old, v.password);
      setToken(r.token, !!r.remember);
      message.success('رمز شما تغییر کرد.');
      form.resetFields();
      onClose();
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="تغییر رمز من" open={open} onCancel={onClose} onOk={() => void submit()} okText="ذخیره" cancelText="بستن" confirmLoading={busy} destroyOnClose>
      <Form form={form} layout="vertical" autoComplete="off">
        <Form.Item name="old" label="رمز فعلی" rules={[{ required: true, message: 'رمز فعلی را وارد کنید.' }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="password"
          label="رمز جدید (حداقل ۸ کاراکتر، شامل حرف انگلیسی و عدد)"
          rules={[
            { required: true, message: 'رمز جدید را وارد کنید.' },
            { min: 8, message: 'رمز باید حداقل ۸ کاراکتر باشد.' },
            { pattern: /[A-Za-z]/, message: 'رمز باید حرف انگلیسی داشته باشد.' },
            { pattern: /\d/, message: 'رمز باید عدد داشته باشد.' },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="repeat"
          label="تکرار رمز جدید"
          dependencies={['password']}
          rules={[
            { required: true, message: 'تکرار رمز را وارد کنید.' },
            ({ getFieldValue }) => ({
              validator: (_, val) => (!val || getFieldValue('password') === val ? Promise.resolve() : Promise.reject(new Error('تکرار رمز یکسان نیست.'))),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
