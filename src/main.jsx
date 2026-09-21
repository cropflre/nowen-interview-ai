import React from 'react';
import { createRoot } from 'react-dom/client';
import GameShell from './GameShell.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><GameShell /></React.StrictMode>
);
