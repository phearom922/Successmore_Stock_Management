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

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

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

  const userData = token ? JSON.parse(atob(token.split('.')[1])) : null;
  const username = userData?.username || 'Admin';
  const role = userData?.role || 'guest';

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
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
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
              <Route path="/settings" element={<div className="p-6"><h2>Settings</h2><p>Settings page under construction</p></div>} />
              <Route path="/" element={<Dashboard />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;