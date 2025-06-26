import { Link } from 'react-router-dom';

  const Sidebar = ({ isOpen, setIsOpen }) => {
    const token = localStorage.getItem('token');
    const userRole = token ? JSON.parse(atob(token.split('.')[1])).role : '';

    return (
      <div className={`${isOpen ? 'w-64' : 'w-16'} transition-all duration-300 bg-gray-800 text-white h-full`}>
        <div className="p-4">
          <h2 className="text-xl font-bold">Stock Management</h2>
        </div>
        <nav className="mt-4">
          <Link to="/" className="block p-2 hover:bg-gray-700">Dashboard</Link>
          <Link to="/issue" className="block p-2 hover:bg-gray-700">Issue</Link>
          {userRole === 'admin' && (
            <Link to="/create-stock" className="block p-2 hover:bg-gray-700">Create Stock</Link>
          )}
          {(userRole === 'admin' || userRole === 'user') && (
            <Link to="/manage-stock-status" className="block p-2 hover:bg-gray-700">Manage Stock Status</Link>
          )}
          <div className="mt-2">
            <span className="block p-2 text-gray-400">Product</span>
            {userRole === 'admin' && (
              <>
                <Link to="/categories" className="block p-2 pl-6 hover:bg-gray-700">Category</Link>
                <Link to="/products" className="block p-2 pl-6 hover:bg-gray-700">Products</Link>
              </>
            )}
          </div>
          {userRole === 'admin' && (
            <div className="mt-2">
              <span className="block p-2 text-gray-400">Warehouse</span>
              <Link to="/warehouses" className="block p-2 pl-6 hover:bg-gray-700">Warehouses</Link>
            </div>
          )}
        </nav>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="absolute top-4 right-4 p-2 bg-gray-700 rounded"
        >
          {isOpen ? '<<' : '>>'}
        </button>
      </div>
    );
  };

  export default Sidebar;