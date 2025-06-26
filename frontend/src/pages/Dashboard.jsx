import { useState, useEffect } from 'react';
  import axios from 'axios';
  import { ToastContainer, toast } from 'react-toastify';
  import 'react-toastify/dist/ReactToastify.css';
  import { useNavigate } from 'react-router-dom';

  const Dashboard = () => {
    const [stats, setStats] = useState({ totalProducts: 0, totalLots: 0, totalWarehouses: 0 });
    const token = localStorage.getItem('token');
    const navigate = useNavigate();

    useEffect(() => {
      if (!token) {
        navigate('/login');
        return;
      }
      const fetchStats = async () => {
        try {
          const [productsRes, lotsRes, warehousesRes] = await Promise.all([
            axios.get('http://localhost:3000/api/products', {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get('http://localhost:3000/api/lots', {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get('http://localhost:3000/api/warehouses', {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);
          setStats({
            totalProducts: productsRes.data.length,
            totalLots: lotsRes.data.length,
            totalWarehouses: warehousesRes.data.length,
          });
        } catch (error) {
          console.error('Error fetching stats:', error);
          if (error.response && error.response.status === 401) {
            toast.error('Session expired, please login again');
            navigate('/login');
          } else {
            toast.error('Failed to load dashboard stats');
          }
        }
      };
      fetchStats();
    }, [token, navigate]);

    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Dashboard</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-100 p-4 rounded">
            <h3>Total Products</h3>
            <p>{stats.totalProducts}</p>
          </div>
          <div className="bg-green-100 p-4 rounded">
            <h3>Total Lots</h3>
            <p>{stats.totalLots}</p>
          </div>
          <div className="bg-yellow-100 p-4 rounded">
            <h3>Total Warehouses</h3>
            <p>{stats.totalWarehouses}</p>
          </div>
        </div>
        <ToastContainer />
      </div>
    );
  };

  export default Dashboard;