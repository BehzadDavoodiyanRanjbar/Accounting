import { useSearchParams } from 'react-router-dom';
import OrderListPage from './OrderListPage';
import OrderPage from './OrderPage';

/** «سفارش‌های تولید»: بدون پارامتر = فهرست؛ با ‎?id=‎ = صفحهٔ همان سفارش */
export default function OrdersRoute() {
  const [sp] = useSearchParams();
  const id = sp.get('id');
  return id ? <OrderPage key={id} id={id} /> : <OrderListPage />;
}
