import { useEffect, useState } from 'react';
  import axios from 'axios';

  const Dashboard = () => {
    const [stats, setStats] = useState({ totalProducts: 0, totalStock: 0 });

    useEffect(() => {
      const fetchStats = async () => {
        const [productsRes, lotsRes] = await Promise.all([
          axios.get('http://localhost:3000/api/products'),
          axios.get('http://localhost:3000/api/lots'),
        ]);
        setStats({
          totalProducts: productsRes.data.length,
          totalStock: lotsRes.data.reduce((sum, lot) => sum + lot.qtyOnHand, 0),
        });
      };
      fetchStats();
    }, []);

    return (
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <h3>Total Products</h3>
          <p className="text-2xl">{stats.totalProducts}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3>Total Stock</h3>
          <p className="text-2xl">{stats.totalStock}</p>
        </div>
      </div>
    );
  };

  export default Dashboard;