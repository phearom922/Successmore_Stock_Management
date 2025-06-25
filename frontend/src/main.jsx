import { StrictMode } from 'react';
  import { createRoot } from 'react-dom/client';
  import './index.css';
  import { BrowserRouter, Routes, Route } from 'react-router-dom';
  import App from './App';
  import Dashboard from './pages/Dashboard';
  import IssueForm from './pages/IssueForm';
  import Login from './pages/Login';
  import CreateStock from './pages/CreateStock';
  import ManageStockStatus from './pages/ManageStockStatus';

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />}>
            <Route index element={<Dashboard />} />
            <Route path="/issue" element={<IssueForm />} />
            <Route path="/create-stock" element={<CreateStock />} />
            <Route path="/manage-stock-status" element={<ManageStockStatus />} />
          </Route>
          <Route path="/login" element={<Login />} />
        </Routes>
      </BrowserRouter>
    </StrictMode>
  );