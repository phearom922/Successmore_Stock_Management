import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Users from './pages/Users';
import Warehouses from './pages/Warehouses';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import IssueForm from './pages/IssueForm';
import CreateStock from './pages/CreateStock';
import ManageStockStatus from './pages/ManageStockStatus';
import Categories from './pages/Categories';
import Products from './pages/Products';
import { toast } from 'react-toastify';
import Suppliers from './pages/Suppliers';
import ReceiveStock from './pages/ReceiveStock';
import ReceiveHistory from './pages/ReceiveHistory';
import LotManagement from './pages/LotManagement';
import ManageDamage from './pages/ManageDamage';
import Settings from './pages/Settings';
import StockReports from './pages/StockReports';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const userData = token ? JSON.parse(atob(token.split('.')[1])) : {};
  const username = userData.username || '';
  const lastName = userData.lastName || '';
  const warehouseCode = userData.warehouseCode || '';
  const warehouseName = userData.warehouseName || '';
  const branch = userData.branch || '';
  const role = userData.role || '';


  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      if (Date.now() >= exp) {
        localStorage.removeItem('token');
        toast.error('Session expired, please login again');
        navigate('/login');
      }
    } catch (error) {
      localStorage.removeItem('token');
      toast.error('Invalid token, please login again');
      navigate('/login');
    }
  }, [token, navigate]);



  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        userRole={role}
      />
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-20'}`}>
        <TopBar
          handleLogout={handleLogout}
          username={username}
          lastName={lastName}
          warehouseCode={warehouseCode}
          warehouseName={warehouseName}
          branch={branch}
          role={role}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-screen mx-auto">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/users" element={<Users />} />
              <Route path="/warehouses" element={<Warehouses />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/issue" element={<IssueForm />} />
              <Route path="/create-stock" element={<CreateStock />} />
              <Route path="/manage-stock-status" element={<ManageStockStatus />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/products" element={<Products />} />
              <Route path="/*" element={<Dashboard />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/receive-stock" element={<ReceiveStock />} />
              <Route path="/receive-history" element={<ReceiveHistory />} />
              <Route path="/lot-management" element={<LotManagement />} />
              <Route path="/manage-damage" element={<ManageDamage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/stock-reports" element={<StockReports />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;