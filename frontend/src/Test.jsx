import { useState } from 'react';
  import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
  import Dashboard from './pages/Dashboard';
  import Products from './pages/Products';
  import Categories from './pages/Categories';
  import Login from './pages/Login';
  import Warehouses from './pages/Warehouses'; // เพิ่มหน้าใหม่

  function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

    const handleLogout = () => {
      localStorage.removeItem('token');
      setIsAuthenticated(false);
    };

    return (
      <Router>
        <div className="flex">
          <div className="w-1/5 bg-gray-800 text-white p-4 min-h-screen">
            <h2 className="text-2xl font-bold mb-4">Stock Management</h2>
            <ul>
              <li className="mb-2"><Link to="/" className="text-blue-300 hover:text-white">Dashboard</Link></li>
              <li className="mb-2"><Link to="/products" className="text-blue-300 hover:text-white">Products</Link></li>
              <li className="mb-2"><Link to="/categories" className="text-blue-300 hover:text-white">Categories</Link></li>
              <li className="mb-2"><Link to="/warehouses" className="text-blue-300 hover:text-white">Warehouses</Link></li> {/* เพิ่มเมนู */}
              {isAuthenticated && (
                <li className="mb-2"><button onClick={handleLogout} className="text-red-300 hover:text-white">Logout</button></li>
              )}
            </ul>
          </div>
          <div className="w-4/5 p-4">
            <Routes>
              <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
              <Route path="/products" element={isAuthenticated ? <Products /> : <Navigate to="/login" />} />
              <Route path="/categories" element={isAuthenticated ? <Categories /> : <Navigate to="/login" />} />
              <Route path="/warehouses" element={isAuthenticated ? <Warehouses /> : <Navigate to="/login" />} /> {/* เพิ่ม Route */}
              <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
            </Routes>
          </div>
        </div>
      </Router>
    );
  }

  export default App;