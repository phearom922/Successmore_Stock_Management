import React, { useState, useEffect, useRef } from 'react';
import { FiLogOut, FiBell, FiMenu, FiX, FiCheck } from 'react-icons/fi';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import moment from 'moment';
import 'moment/locale/th'; // สำหรับภาษาไทย

const TopBar = ({ handleLogout, username, toggleSidebar }) => {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // เพิ่มการตรวจจับการคลิกภายนอก
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('http://localhost:3000/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // เรียงลำดับ notification ใหม่สุดอยู่บน
      const sortedNotifications = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setNotifications(sortedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:3000/api/notifications/${notificationId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(notifications.map(n => 
        n._id === notificationId ? { ...n, read: true } : n
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:3000/api/notifications/mark-all-read', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-screen mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button 
              onClick={toggleSidebar}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <FiMenu className="h-6 w-6" />
            </button>
            <h2 className="text-xl font-semibold text-gray-800">
              Hello, <span className="text-blue-600">{username}</span>
            </h2>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative" ref={dropdownRef}>
              <button 
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full relative focus:outline-none"
                aria-label="Notifications"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <FiBell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-red-500 rounded-full -mt-1 -mr-1">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-xl z-50 border border-gray-200">
                  <div className="flex justify-between items-center p-3 border-b border-gray-200 bg-gray-50 rounded-t-md">
                    <h3 className="font-medium text-gray-800">Notification</h3>
                    <div className="flex space-x-2">
                      {unreadCount > 0 && (
                        <button 
                          onClick={markAllAsRead}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                          title="ทำทั้งหมดเป็นอ่านแล้ว"
                        >
                          <FiCheck className="mr-1" /> Read All
                        </button>
                      )}
                      <button 
                        onClick={() => setShowDropdown(false)}
                        className="text-gray-500 hover:text-gray-700"
                        title="ปิด"
                      >
                        <FiX />
                      </button>
                    </div>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <div
                          key={notif._id}
                          className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors duration-200 ${
                            !notif.read ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => markAsRead(notif._id)}
                        >
                          <div className="flex justify-between items-start">
                            <p className="text-sm text-gray-800">{notif.message}</p>
                            {!notif.read && (
                              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full ml-2"></span>
                            )}
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-gray-500">
                              {moment(notif.createdAt).locale('th').fromNow()}
                            </span>
                            <span className="text-xs text-gray-400">
                              {notif.read ? 'Read' : 'New'}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No notification
                      </div>
                    )}
                  </div>
                  
                  {notifications.length > 0 && (
                    <div className="p-2 border-t border-gray-200 text-center bg-gray-50 rounded-b-md">
                      <div 
                        href="/notifications" 
                        className="text-xs py-1 text-blue-600 hover:text-blue-800"
                      >
                        See All
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors focus:outline-none"
            >
              <FiLogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
};

export default TopBar;