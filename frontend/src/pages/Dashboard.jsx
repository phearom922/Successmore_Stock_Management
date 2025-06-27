import { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [stats, setStats] = useState({ totalProducts: 0, totalLots: 0, totalWarehouses: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        toast.error('Session expired, please login again');
        navigate('/login');
        return;
      }
    } catch {
      localStorage.removeItem('token');
      toast.error('Invalid token, please login again');
      navigate('/login');
      return;
    }

    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const [productsRes, lotsRes, warehousesRes] = await Promise.all([
          axios.get('http://localhost:3000/api/products', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:3000/api/lots', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:3000/api/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setStats({
          totalProducts: productsRes.data.length,
          totalLots: lotsRes.data.length,
          totalWarehouses: warehousesRes.data.length,
        });
      } catch (error) {
        if (error.response?.status === 401) {
          toast.error('Session expired, please login again');
          navigate('/login');
        } else {
          toast.error('Failed to load dashboard stats');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [token, navigate]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Dashboard</h2>
      {isLoading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-blue-100 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-blue-800">Total Products</h3>
            <p className="text-2xl font-bold text-blue-600">{stats.totalProducts}</p>
          </div>
          <div className="bg-green-100 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-green-800">Total Lots</h3>
            <p className="text-2xl font-bold text-green-600">{stats.totalLots}</p>
          </div>
          <div className="bg-yellow-100 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-yellow-800">Total Warehouses</h3>
            <p className="text-2xl font-bold text-yellow-600">{stats.totalWarehouses}</p>
          </div>
        </div>
      )}
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Dashboard;