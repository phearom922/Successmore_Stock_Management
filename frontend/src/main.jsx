import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import App from './App';
import React from 'react';
import Dashboard from './pages/Dashboard';
import IssueForm from './pages/IssueForm';
import Login from './pages/Login';
import CreateStock from './pages/CreateStock';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="issue" element={<IssueForm />} />
          <Route path="create-stock" element={<CreateStock />} />
        </Route>
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
