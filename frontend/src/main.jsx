import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import React from 'react';
import Dashboard from './pages/Dashboard';
import IssueForm from './pages/IssueForm';



createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="issue" element={<IssueForm />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
