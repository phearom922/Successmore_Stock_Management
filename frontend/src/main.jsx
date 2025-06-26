import { StrictMode } from 'react';
  import { createRoot } from 'react-dom/client';
  import './index.css';
  import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
  
  import App from './App';
  import Dashboard from './pages/Dashboard';
  import IssueForm from './pages/IssueForm';
  import Login from './pages/Login';
  import CreateStock from './pages/CreateStock';
  import ManageStockStatus from './pages/ManageStockStatus';
  import Categories from './pages/Categories';
  import Products from './pages/Products';
  import Warehouses from './pages/Warehouses';

  const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/login" />;
  };

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />}>
            <Route index element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/issue" element={<ProtectedRoute><IssueForm /></ProtectedRoute>} />
            <Route path="/create-stock" element={<ProtectedRoute><CreateStock /></ProtectedRoute>} />
            <Route path="/manage-stock-status" element={<ProtectedRoute><ManageStockStatus /></ProtectedRoute>} />
            <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
            <Route path="/warehouses" element={<ProtectedRoute><Warehouses /></ProtectedRoute>} /> {/* เพิ่ม Route */}
          </Route>
          <Route path="/login" element={<Login />} />
        </Routes>
      </BrowserRouter>
    </StrictMode>
  );