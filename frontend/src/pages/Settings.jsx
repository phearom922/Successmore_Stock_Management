import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from 'react-modal'; // ต้องติดตั้ง: npm install react-modal

Modal.setAppElement('#root'); // ป้องกันการ warning ใน console

const Settings = () => {
  const [warningDays, setWarningDays] = useState(15);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWarningDays(response.data.expirationWarningDays);
      setLowStockThreshold(response.data.lowStockThreshold);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    }
  };

  const handleSave = () => {
    setIsModalOpen(true);
  };

  const handleConfirmSave = async () => {
    try {
      const response = await axios.put(
        'http://localhost:3000/api/settings',
        { expirationWarningDays: warningDays, lowStockThreshold },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Settings saved successfully');
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const handleCancelSave = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="p-6 max-w-screen mx-auto bg-gray-50 rounded-xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Expiration Warning Days</label>
          <input
            type="number"
            value={warningDays}
            onChange={(e) => setWarningDays(Number(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            min="1"
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
          />
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Save
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onRequestClose={handleCancelSave}
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
        <h2 className="text-lg font-bold mb-4">Confirm Save</h2>
        <p>Are you sure you want to save these settings?</p>
        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={handleCancelSave}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSave}
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