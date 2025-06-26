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

const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const token = localStorage.getItem('token');

  if (!token) return <Navigate to="/login" />;

  const userRole = JSON.parse(atob(token.split('.')[1])).role;

  // ถ้าไม่กำหนด requiredRoles หรือ roles เป็น empty array แปลว่าให้ทุก role เข้าถึงได้
  if (requiredRoles.length > 0 && !requiredRoles.includes(userRole)) {
    return <Navigate to="/" />;
  }

  return children;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/issue" element={
            <ProtectedRoute>
              <IssueForm />
            </ProtectedRoute>
          } />
          <Route path="/create-stock" element={
            <ProtectedRoute requiredRoles={['admin']}>
              <CreateStock />
            </ProtectedRoute>
          } />
          <Route path="/manage-stock-status" element={
            <ProtectedRoute requiredRoles={['admin', 'user']}>
              <ManageStockStatus />
            </ProtectedRoute>
          } />
          <Route path="/categories" element={
            <ProtectedRoute requiredRoles={['admin']}>
              <Categories />
            </ProtectedRoute>
          } />
          <Route path="/products" element={
            <ProtectedRoute requiredRoles={['admin']}>
              <Products />
            </ProtectedRoute>
          } />
          <Route path="/warehouses" element={
            <ProtectedRoute requiredRoles={['admin']}>
              <Warehouses />
            </ProtectedRoute>
          } />
        </Route>
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);