import { Link } from 'react-router-dom';

  const Sidebar = ({ isOpen, setIsOpen }) => {
    return (
      <div className={`${isOpen ? 'w-64' : 'w-16'} transition-all duration-300 bg-gray-800 text-white h-full`}>
        <div className="p-4">
          <h2 className="text-xl font-bold">Stock Management</h2>
        </div>
        <nav className="mt-4">
          <Link to="/" className="block p-2 hover:bg-gray-700">Dashboard</Link>
          <Link to="/issue" className="block p-2 hover:bg-gray-700">Issue</Link>
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