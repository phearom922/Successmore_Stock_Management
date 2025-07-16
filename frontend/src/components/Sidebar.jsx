import { Link, useLocation } from 'react-router-dom';
import {
  FiHome,
  FiUpload,
  FiPackage,
  FiLayers, FiTruck, FiChevronLeft, FiChevronRight, FiBox, FiClipboard, FiDatabase, FiUsers,
  FiArrowDownCircle, FiArrowUpCircle
} from 'react-icons/fi';
import { FaBuilding, FaCubes } from "react-icons/fa";
import { GiBrokenPottery } from "react-icons/gi";
import { IoSettingsOutline } from "react-icons/io5";
import { HiOutlineDocumentReport } from "react-icons/hi";
import { TbTransfer } from "react-icons/tb";

const Sidebar = ({ isOpen, setIsOpen, userRole }) => { // เพิ่ม userRole กลับคืนมา
  const location = useLocation();
  const token = localStorage.getItem('token');

  // ตรวจสอบ token validity และดึง permissions
  const isValidToken = () => {
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  };

  const getPermissions = () => {
    if (!token) return [];
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.permissions || [];
    } catch {
      return [];
    }
  };

  const hasPermission = (feature, permission = 'Show') => {
    const perms = getPermissions();
    const featurePerm = perms.find(p => p.feature === feature);
    return featurePerm && featurePerm.permissions.includes(permission);
  };

  const isActive = (path) => location.pathname === path;

  // ถ้า token ไม่ถูกต้อง จะไม่แสดง Sidebar
  if (!isValidToken()) {
    return null;
  }

  return (
    <div className={`${isOpen ? 'w-64' : 'w-20'} flex flex-col border-r-1 border-gray-200 transition-all duration-300 bg-gray-100 text-gray-700 h-screen fixed z-10`}>
      <div className="p-4 flex items-center justify-between ">
        {isOpen ? (
          <h2 className="text-xl font-bold whitespace-nowrap flex items-center">
            <FiBox className="mr-2" />
            Stock Management
          </h2>
        ) : (
          <div className="w-8 h-8 flex items-center justify-center">
            <FiBox className="text-xl" />
          </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 rounded-full hover:bg-blue-200 hover:text-blue-700 transition-colors"
          aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isOpen ? <FiChevronLeft /> : <FiChevronRight />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <div className="space-y-1">
          <Link
            to="/"
            className={`flex items-center ${isOpen ? 'px-4 py-2 mx-2' : 'px-2 py-3 mx-2 justify-center'} rounded-sm transition-colors ${isActive('/') ? 'bg-blue-200 text-blue-700' : 'hover:bg-gray-200 text-gray-900'}`}
          >
            <FiHome className={`${isOpen ? 'mr-3' : ''} text-sm`} />
            {isOpen && <span className='text-sm'>Dashboard</span>}
          </Link>
          {hasPermission('manageDamage', 'Show') && (
            <Link
              to="/manage-damage"
              className={`flex items-center ${isOpen ? 'px-4 py-2 mx-2' : 'px-2 py-3 mx-2 justify-center'} rounded-sm transition-colors ${isActive('/manage-damage') ? 'bg-blue-200 text-blue-700' : 'hover:bg-gray-200 text-gray-900'}`}
            >
              <GiBrokenPottery className={`${isOpen ? 'mr-3' : ''} text-sm`} />
              {isOpen && <span className='text-sm'>Manage Damage</span>}
            </Link>
          )}

          {hasPermission('lotManagement', 'Show') && (
            <Link
              to="/lot-management"
              className={`flex items-center ${isOpen ? 'px-4 py-2 mx-2' : 'px-2 py-3 mx-2 justify-center'} rounded-sm transition-colors ${isActive('/lot-management') ? 'bg-blue-200 text-blue-700' : 'hover:bg-gray-200 text-gray-900'}`}
            >
              <FaCubes className={`${isOpen ? 'mr-3' : ''} text-sm`} />
              {isOpen && <span className='text-sm'>Lot Management</span>}
            </Link>
          )}
        </div>
        <div className="mt-6">
          {isOpen ? (
            <span className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Product
            </span>
          ) : (
            <div className="border-t border-gray-700 mx-2 my-2"></div>
          )}
          <div className="mt-1 space-y-1">
            {hasPermission('category', 'Show') && (
              <Link
                to="/categories"
                className={`flex items-center ${isOpen ? 'px-4 py-2 mx-2 pl-8' : 'px-2 py-3 mx-2 justify-center'} rounded-sm transition-colors ${isActive('/categories') ? 'bg-blue-200 text-blue-700' : 'hover:bg-gray-200 text-gray-900'}`}
              >
                <FiLayers className={`${isOpen ? 'mr-3' : ''} text-sm`} />
                {isOpen && <span className='text-sm'>Category</span>}
              </Link>
            )}
            {hasPermission('products', 'Show') && (
              <Link
                to="/products"
                className={`flex items-center ${isOpen ? 'px-4 py-2 mx-2 pl-8' : 'px-2 py-3 mx-2 justify-center'} rounded-sm transition-colors ${isActive('/products') ? 'bg-blue-200 text-blue-700' : 'hover:bg-gray-200 text-gray-900'}`}
              >
                <FiDatabase className={`${isOpen ? 'mr-3' : ''} text-sm`} />
                {isOpen && <span className='text-sm'>Products</span>}
              </Link>
            )}
          </div>
        </div>










        <div className="mt-6">
          {isOpen ? (
            <span className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Stock Management
            </span>
          ) : (
            <div className="border-t border-gray-700 mx-2 my-2"></div>
          )}
          <div className="mt-1 space-y-1">
            {(userRole === 'admin' || userRole === 'user') && ( // ยังคงใช้ userRole สำหรับเมนูทั่วไป
              <Link
                to="/receive-stock"
                className={`flex items-center ${isOpen ? 'px-4 py-2 mx-2 pl-8' : 'px-2 py-3 mx-2 justify-center'} rounded-sm transition-colors ${isActive('/receive-stock') ? 'bg-blue-200 text-blue-700' : 'hover:bg-gray-200 text-gray-900'}`}
              >
                <FiArrowDownCircle className={`${isOpen ? 'mr-3' : ''} text-sm`} />
                {isOpen && <span className='text-sm'>Receive Stock</span>}
              </Link>
            )}
            {(userRole === 'admin' || userRole === 'user') && ( // ยังคงใช้ userRole สำหรับเมนูทั่วไป
              <Link
                to="/transfer-order"
                className={`flex items-center ${isOpen ? 'px-4 py-2 mx-2 pl-8' : 'px-2 py-3 mx-2 justify-center'} rounded-sm transition-colors ${isActive('/transfer-order') ? 'bg-blue-200 text-blue-700' : 'hover:bg-gray-200 text-gray-900'}`}
              >
                <TbTransfer className={`${isOpen ? 'mr-3' : ''} text-sm`} />
                {isOpen && <span className='text-sm'>Transfer Order</span>}
              </Link>
            )}
            {(userRole === 'admin' || userRole === 'user') && ( // ยังคงใช้ userRole สำหรับเมนูทั่วไป
              <Link
                to="/issue-stock"
                className={`flex items-center ${isOpen ? 'px-4 py-2 mx-2 pl-8' : 'px-2 py-3 mx-2 justify-center'} rounded-sm transition-colors ${isActive('/issue-stock') ? 'bg-blue-200 text-blue-700' : 'hover:bg-gray-200 text-gray-900'}`}
              >
                <FiArrowUpCircle className={`${isOpen ? 'mr-3' : ''} text-sm`} />
                {isOpen && <span className='text-sm'>Issue Stock</span>}
              </Link>
            )}
          </div>
        </div>

        <div className="mt-6">
          {isOpen ? (
            <span className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              All Report
            </span>
          ) : (
            <div className="border-t border-gray-700 mx-2 my-2"></div>
          )}
          <div className="mt-1 space-y-1">
            {(userRole === 'admin' || userRole === 'user') && (
              <Link
                to="/receive-history"
                className={`flex items-center ${isOpen ? 'px-4 py-2 mx-2 pl-8' : 'px-2 py-3 mx-2 justify-center'} rounded-sm transition-colors ${isActive('/receive-history') ? 'bg-blue-200 text-blue-700' : 'hover:bg-gray-200 text-gray-900'}`}
              >
                <FiArrowDownCircle className={`${isOpen ? 'mr-3' : ''} text-sm`} />
                {isOpen && <span className='text-sm'>Receive History</span>}
              </Link>
            )}
            {(userRole === 'admin' || userRole === 'user') && (
              <Link
                to="/issue-history"
                className={`flex items-center ${isOpen ? 'px-4 py-2 mx-2 pl-8' : 'px-2 py-3 mx-2 justify-center'} rounded-sm transition-colors ${isActive('/issue-history') ? 'bg-blue-200 text-blue-700' : 'hover:bg-gray-200 text-gray-900'}`}
              >
                <FiArrowUpCircle className={`${isOpen ? 'mr-3' : ''} text-sm`} />
                {isOpen && <span className='text-sm'>Issue History</span>}
              </Link>
            )}
            {(userRole === 'admin' || userRole === 'user') && (
              <Link
                to="/stock-reports"
                className={`flex items-center ${isOpen ? 'px-4 py-2 mx-2 pl-8' : 'px-2 py-3 mx-2 justify-center'} rounded-sm transition-colors ${isActive('/stock-reports') ? 'bg-blue-200 text-blue-700' : 'hover:bg-gray-200 text-gray-900'}`}
              >
                <HiOutlineDocumentReport className={`${isOpen ? 'mr-3' : ''} text-sm`} />
                {isOpen && <span className='text-sm'>Stock Reports</span>}
              </Link>
            )}
          </div>
        </div>




        {userRole === 'admin' && (
          <div className="mt-6">
            {isOpen ? (
              <span className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                System
              </span>
            ) : (
              <div className="border-t border-gray-700 mx-2 my-2"></div>
            )}
            <div className="mt-1 space-y-1">
              <Link
                to="/users"
                className={`flex items-center ${isOpen ? 'px-4 py-2 mx-2 pl-8' : 'px-2 py-3 mx-2 justify-center'} rounded-sm transition-colors ${isActive('/users') ? 'bg-blue-200 text-blue-700' : 'hover:bg-gray-200 text-gray-900'}`}
              >
                <FiUsers className={`${isOpen ? 'mr-3' : ''} text-sm`} />
                {isOpen && <span className='text-sm'>Users Management</span>}
              </Link>

              <Link
                to="/suppliers"
                className={`flex items-center ${isOpen ? 'px-4 py-2 mx-2 pl-8' : 'px-2 py-3 mx-2 justify-center'} rounded-sm transition-colors ${isActive('/suppliers') ? 'bg-blue-200 text-blue-700' : 'hover:bg-gray-200 text-gray-900'}`}
              >
                <FaBuilding className={`${isOpen ? 'mr-3' : ''} text-sm`} />
                {isOpen && <span className='text-sm'>Suppliers</span>}
              </Link>

              <Link
                to="/warehouses"
                className={`flex items-center ${isOpen ? 'px-4 py-2 mx-2 pl-8' : 'px-2 py-3 mx-2 justify-center'} rounded-sm transition-colors ${isActive('/warehouses') ? 'bg-blue-200 text-blue-700' : 'hover:bg-gray-200 text-gray-900'}`}
              >
                <FiTruck className={`${isOpen ? 'mr-3' : ''} text-sm`} />
                {isOpen && <span className='text-sm'>Warehouses</span>}
              </Link>

              <Link
                to="/settings"
                className={`flex items-center ${isOpen ? 'px-4 py-2 mx-2 pl-8' : 'px-2 py-3 mx-2 justify-center'} rounded-sm transition-colors ${isActive('/settings') ? 'bg-blue-200 text-blue-700' : 'hover:bg-gray-200 text-gray-900'}`}
              >
                <IoSettingsOutline className={`${isOpen ? 'mr-3' : ''} text-sm`} />
                {isOpen && <span className='text-sm'>Settings</span>}
              </Link>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
};

export default Sidebar;