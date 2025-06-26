import { useNavigate } from 'react-router-dom';

  const TopBar = ({ handleLogout, username }) => {
    const navigate = useNavigate();

    const handleLogoutClick = () => {
      if (handleLogout) handleLogout();
      navigate('/login');
    };

    return (
      <div className="bg-white p-4 shadow">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Welcome, {username || 'Guest'}</h2>
          <div className="flex space-x-4">
            <button className="p-2 bg-gray-200 rounded">Notifications</button>
            <button
              onClick={handleLogoutClick}
              className="p-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  };

  export default TopBar;