import React from 'react';
import ReactDOM from 'react-dom/client';
import 'antd/dist/reset.css';
import '../styles.css';
import PortalApp from './PortalApp';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PortalApp />
  </React.StrictMode>,
);
