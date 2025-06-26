import { useState, useEffect } from 'react';
  import { Outlet, useNavigate } from 'react-router-dom';
  import Sidebar from './components/Sidebar';
  import TopBar from './components/TopBar';

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
      }
    }, [token, navigate]);

    const username = token ? JSON.parse(atob(token.split('.')[1])).username || 'Admin' : 'Guest';

    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className="flex-1 flex flex-col">
          <TopBar handleLogout={handleLogout} username={username} />
          <main className="p-4">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  export default App;