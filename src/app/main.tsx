import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import rawMap from 'virtual:map-data';
import { buildMap } from '../core';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App map={buildMap(rawMap)} />
  </StrictMode>,
);
