import React, { useState, useEffect, useRef } from 'react';
import { FiLogOut, FiBell, FiMenu, FiX, FiCheck, FiUser } from 'react-icons/fi';
import axios from 'axios';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import moment from 'moment';
import 'moment/locale/th';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const TopBar = ({
  handleLogout,
  username,
  lastName,
  warehouseCode,
  warehouseName,
  branch,
  role,
  toggleSidebar,
}) => {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const dropdownRef = useRef(null);
  const profileRef = useRef(null);

  // Click outside for notification dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`${API_BASE_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sortedNotifications = data.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setNotifications(sortedNotifications);
    } catch (error) {
      // silent
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/notifications/${notificationId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotifications((notifications) =>
        notifications.map((n) =>
          n._id === notificationId ? { ...n, read: true } : n
        )
      );
    } catch (error) {}
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      let success = false;
      try {
        await axios.put(
          `${API_BASE_URL}/api/notifications/mark-all-read`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        success = true;
      } catch {
        success = false;
      }
      if (!success) {
        await Promise.all(
          notifications.filter((n) => !n.read).map((n) =>
            axios.put(
              `${API_BASE_URL}/api/notifications/${n._id}`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            )
          )
        );
      }
      fetchNotifications();
    } catch (error) {}
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

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
            <div
              className="relative"
              ref={profileRef}
              onMouseEnter={() => setShowProfile(true)}
              onMouseLeave={() => setShowProfile(false)}
            >
              <h2 className="text-xl font-semibold text-gray-800 cursor-pointer flex items-center gap-2 group">
                Hello,
                <span className="text-blue-600 underline decoration-dotted decoration-2 underline-offset-4 transition group-hover:text-blue-800 flex items-center gap-1">
                  <FiUser className="inline-block" />
                  {lastName}
                </span>
              </h2>
              {showProfile && (
                <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 animate-fade-in">
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-blue-100 text-blue-600 rounded-full p-2">
                        <FiUser className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-lg">
                          {lastName}
                        </div>
                        <div className="text-xs text-gray-500">{role}</div>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Username:</span>
                        <span className="font-medium text-gray-700">{username}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Last Name:</span>
                        <span className="font-medium text-gray-700">{lastName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">WH Code:</span>
                        <span className="font-medium text-gray-700">{warehouseCode || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">WH Name:</span>
                        <span className="font-medium text-gray-700">{warehouseName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Branch:</span>
                        <span className="font-medium text-gray-700">{branch || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Role:</span>
                        <span className="font-medium text-gray-700 capitalize">{role}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
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