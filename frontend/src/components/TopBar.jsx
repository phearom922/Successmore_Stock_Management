import { FiLogOut, FiMenu } from 'react-icons/fi';

const TopBar = ({ handleLogout, username, toggleSidebar }) => {
  const token = localStorage.getItem('token');

  // ตรวจสอบ token validity
  const isValidToken = () => {
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  };

  if (!isValidToken()) {
    return null;
  }

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button 
              onClick={toggleSidebar}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <FiMenu className="h-6 w-6" />
            </button>
            <h2 className="text-xl font-semibold text-gray-800">
              สวัสดี, <span className="text-blue-600">{username}</span>
            </h2>
          </div>
          
          <div className="flex items-center">
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors focus:outline-none"
            >
              <FiLogOut className="h-5 w-5" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopBar;