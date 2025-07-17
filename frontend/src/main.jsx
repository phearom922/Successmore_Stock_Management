import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './index.css';
import App from './App';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Categories from './pages/Categories';
import Products from './pages/Products';
import Warehouses from './pages/Warehouses';
import Users from './pages/Users';
import ReceiveHistory from './pages/ReceiveHistory';
import LotManagement from './pages/LotManagement';
import ManageDamage from './pages/ManageDamage';
import Settings from './pages/Settings';
import StockReports from './pages/StockReports';
import Suppliers from './pages/Suppliers';
import IssueStock from './pages/IssueStock';
import IssueHistory from './pages/IssueHistory';
import TransferOrder from './pages/TransferOrder';
import AdjustStock from './pages/AdjustStock';


// Component เพื่อแสดง Toast เมื่อ Unauthorized
const UnauthorizedToast = () => {
  const location = useLocation();
  const state = location.state;

  useEffect(() => {
    if (state && state.message === 'Unauthorized access') {
      toast.error(state.message);
    }
  }, [state]);

  return null;
};

const ProtectedRoute = ({ children, requiredRoles = [], requiredPermissions = [] }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" />;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('token');
      return <Navigate to="/login" />;
    }
    const userRole = payload.role;
    const userPermissions = payload.permissions || [];

    // ตรวจสอบ Permissions ก่อน Role
    if (requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.every(perm => {
        const featurePerm = userPermissions.find(p => p.feature === perm.feature);
        if (!featurePerm) return false;
        // ถ้าไม่ระบุ permissions หรือเป็น Array ว่าง ให้ยอมรับถ้ามีฟีเจอร์นั้น
        if (!perm.permissions || perm.permissions.length === 0) return true;
        return perm.permissions.every(p => featurePerm.permissions.includes(p));
      });
      if (!hasPermission) {
        return <Navigate to="/" replace state={{ message: 'Unauthorized access' }} />;
      }
    }

    // ตรวจสอบ Role เฉพาะกรณีที่ต้องการ Role เฉพาะ (เช่น admin)
    if (requiredRoles.length > 0 && !requiredRoles.includes(userRole)) {
      return <Navigate to="/" replace state={{ message: 'Unauthorized access' }} />;
    }

    return (
      <>
        <UnauthorizedToast />
        {children}
      </>
    );
  } catch {
    localStorage.removeItem('token');
    return <Navigate to="/login" />;
  }
};

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
          <Route index element={<ProtectedRoute requiredRoles={['admin', 'user']}><Dashboard /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute requiredRoles={['admin']}><Users /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute requiredRoles={['admin']}><Settings /></ProtectedRoute>} />       
          <Route path="/categories" element={<ProtectedRoute requiredPermissions={[{ feature: 'category', permissions: ['Show'] }]}><Categories /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute requiredPermissions={[{ feature: 'products', permissions: ['Show'] }]}><Products /></ProtectedRoute>} />
          <Route path="/warehouses" element={<ProtectedRoute requiredRoles={['admin']}><Warehouses /></ProtectedRoute>} />
          <Route path="/receive-history" element={<ProtectedRoute requiredRoles={['admin', 'user']}><ReceiveHistory /></ProtectedRoute>} />
          <Route path="/lot-management" element={<ProtectedRoute requiredPermissions={[{ feature: 'lotManagement', permissions: ['Show'] }]}><LotManagement /></ProtectedRoute>} />
          <Route path="/manage-damage" element={<ProtectedRoute requiredPermissions={[{ feature: 'manageDamage', permissions: ['Show'] }]}><ManageDamage /></ProtectedRoute>} />
          <Route path="/stock-reports" element={<ProtectedRoute requiredRoles={['admin', 'user']}><StockReports /></ProtectedRoute>} />
          <Route path="/suppliers" element={<ProtectedRoute requiredRoles={['admin', 'user']}><Suppliers /></ProtectedRoute>} />
          <Route path="/issue-stock" element={<ProtectedRoute requiredRoles={['admin', 'user']}><IssueStock /></ProtectedRoute>} />
          <Route path="/issue-history" element={<ProtectedRoute requiredRoles={['admin', 'user']}><IssueHistory /></ProtectedRoute>} />
          <Route path="/transfer-order" element={<ProtectedRoute requiredRoles={['admin', 'user']}><TransferOrder /></ProtectedRoute>} />
          <Route path="/adjust-stock" element={<ProtectedRoute requiredRoles={['admin']}><AdjustStock /></ProtectedRoute>} />
          <Route path="*" element={<ErrorBoundary />} />
        </Route>
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);