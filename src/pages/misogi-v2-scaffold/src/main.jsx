import './shared/styles/00_tokens.css';
import './shared/styles/10_zindex.css';
import './shared/styles/20_overlays.css';
import './shared/styles/30_layout.css';
import './shared/styles/components.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter basename="/v2">
    <App />
  </BrowserRouter>
);
