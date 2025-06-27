import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import App from './App';
import Dashboard from './pages/Dashboard';
import IssueForm from './pages/IssueForm';
import Login from './pages/Login';
import CreateStock from './pages/CreateStock';
import ManageStockStatus from './pages/ManageStockStatus';
import Categories from './pages/Categories';
import Products from './pages/Products';
import Warehouses from './pages/Warehouses';
import Users from './pages/Users';

const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" />;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('token');
      return <Navigate to="/login" />;
    }
    if (requiredRoles.length > 0 && !requiredRoles.includes(payload.role)) {
      return <Navigate to="/" />;
    }
    return children;
  } catch {
    localStorage.removeItem('token');
    return <Navigate to="/login" />;
  }
};

const Settings = () => (
  <div className="p-6">
    <h2 className="text-xl font-bold mb-4">Settings</h2>
    <p>Settings page under construction</p>
  </div>
);

const ErrorBoundary = () => (
  <div className="p-6">
    <h2 className="text-xl font-bold mb-4">Error</h2>
    <p>Something went wrong. Please try again.</p>
  </div>
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/issue" element={<ProtectedRoute><IssueForm /></ProtectedRoute>} />
          <Route path="/create-stock" element={<ProtectedRoute requiredRoles={['admin']}><CreateStock /></ProtectedRoute>} />
          <Route path="/manage-stock-status" element={<ProtectedRoute requiredRoles={['admin', 'user']}><ManageStockStatus /></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute requiredRoles={['admin']}><Categories /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute requiredRoles={['admin']}><Products /></ProtectedRoute>} />
          <Route path="/warehouses" element={<ProtectedRoute requiredRoles={['admin']}><Warehouses /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute requiredRoles={['admin']}><Users /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<ErrorBoundary />} />
        </Route>
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);