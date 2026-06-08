import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import '../tokens.css'
import './index.css'

(window as any).__appMounted = true;
createRoot(document.getElementById("root")!).render(<App />);
