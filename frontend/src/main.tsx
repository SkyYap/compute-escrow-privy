/**
 * @file main.tsx
 * @description Application entry point
 * 
 * This is the entry point for the React application. It:
 * - Renders the root App component
 * - Sets up React StrictMode for development
 * - Mounts the app to the DOM
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

