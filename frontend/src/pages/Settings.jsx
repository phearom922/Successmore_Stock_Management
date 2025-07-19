import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from 'react-modal';

Modal.setAppElement('#root'); // ป้องกันการ warning ใน console

const Settings = () => {
  const [warningDays, setWarningDays] = useState(15);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [isIssueStockNotificationEnabled, setIssueStockNotificationEnabled] = useState(true);
  const [isIssueHistoryNotificationEnabled, setIssueHistoryNotificationEnabled] = useState(true);
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [chatId, setChatId] = useState('-4871143154');
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const settings = response.data;
      setWarningDays(settings.expirationWarningDays);
      setLowStockThreshold(settings.lowStockThreshold);
      setIssueStockNotificationEnabled(settings.issueStockNotificationEnabled || false); // Default to false if undefined
      setIssueHistoryNotificationEnabled(settings.issueHistoryNotificationEnabled || false); // Default to false if undefined
      setTelegramBotToken(settings.telegramBotToken || '');
      setChatId(settings.chatId || '-4871143154');
      console.log('Fetched Settings:', settings); // Debug
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    }
  };

  const handleSaveNotificationSettings = () => {
    setIsNotificationModalOpen(true);
  };

  const handleConfirmSaveNotification = async () => {
    try {
      const payload = {
        expirationWarningDays: warningDays,
        lowStockThreshold,
        issueStockNotificationEnabled: isIssueStockNotificationEnabled,
        issueHistoryNotificationEnabled: isIssueHistoryNotificationEnabled,
      };
      console.log('Saving Notification Settings:', payload); // Debug
      const response = await axios.put(
        'http://localhost:3000/api/settings/notification',
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Notification settings saved successfully');
      setIsNotificationModalOpen(false);
      await fetchSettings(); // รีเฟรช Settings หลังบันทึก
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('Failed to save notification settings');
    }
  };

  const handleSaveTelegramConfig = () => {
    setIsTelegramModalOpen(true);
  };

  const handleConfirmSaveTelegram = async () => {
    try {
      const payload = {
        telegramBotToken,
        chatId,
      };
      console.log('Saving Telegram Config:', payload); // Debug
      const response = await axios.put(
        'http://localhost:3000/api/settings/telegram',
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Telegram configuration saved successfully');
      setIsTelegramModalOpen(false);
      await fetchSettings(); // รีเฟรช Settings หลังบันทึก
    } catch (error) {
      console.error('Error saving telegram configuration:', error);
      toast.error('Failed to save telegram configuration');
    }
  };

  const handleCancelSave = (modalType) => {
    if (modalType === 'notification') setIsNotificationModalOpen(false);
    if (modalType === 'telegram') setIsTelegramModalOpen(false);
  };

  return (
    <div className="p-6 max-w-screen mx-auto bg-gray-50 rounded-xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-6">
        {/* Expiration Warning and Low Stock Threshold */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Expiration Warning Days</label>
          <input
            type="number"
            value={warningDays}
            onChange={(e) => setWarningDays(Number(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            min="1"
            disabled // เก็บไว้ก่อนตามคำขอ
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Low Stock Threshold</label>
          <input
            type="number"
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(Number(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            min="1"
            disabled // เก็บไว้ก่อนตามคำขอ
          />
        </div>

        {/* Notification Settings */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notification Settings</label>
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={isIssueStockNotificationEnabled}
                onChange={(e) => setIssueStockNotificationEnabled(e.target.checked)}
                className="mr-2 leading-tight"
              />
              <span>Enable Issue Stock Notifications</span>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={isIssueHistoryNotificationEnabled}
                onChange={(e) => setIssueHistoryNotificationEnabled(e.target.checked)}
                className="mr-2 leading-tight"
              />
              <span>Enable Issue History Notifications</span>
            </div>
            <button
              onClick={handleSaveNotificationSettings}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save Notification Settings
            </button>
          </div>
        </div>

        {/* Telegram Configuration */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Telegram Configuration</label>
          <div className="space-y-2">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Telegram Bot Token</label>
              <input
                type="text"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter Telegram Bot Token"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Chat ID</label>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter Chat ID (e.g., -4871143154)"
              />
            </div>
            <button
              onClick={handleSaveTelegramConfig}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save Telegram Configuration
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isNotificationModalOpen}
        onRequestClose={() => handleCancelSave('notification')}
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            width: '300px',
            padding: '20px',
          },
        }}
      >
        <h2 className="text-lg font-bold mb-4">Confirm Save Notification Settings</h2>
        <p>Are you sure you want to save these notification settings?</p>
        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={() => handleCancelSave('notification')}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSaveNotification}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isTelegramModalOpen}
        onRequestClose={() => handleCancelSave('telegram')}
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            width: '300px',
            padding: '20px',
          },
        }}
      >
        <h2 className="text-lg font-bold mb-4">Confirm Save Telegram Configuration</h2>
        <p>Are you sure you want to save these telegram settings?</p>
        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={() => handleCancelSave('telegram')}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSaveTelegram}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Settings;