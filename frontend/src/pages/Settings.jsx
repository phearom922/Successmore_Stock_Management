import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import Modal from "react-modal";

Modal.setAppElement("#root"); // ป้องกันการ warning ใน console

const Settings = () => {
  const [warningDays, setWarningDays] = useState(15);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [isIssueStockNotificationEnabled, setIssueStockNotificationEnabled] =
    useState(true);
  const [
    isIssueHistoryNotificationEnabled,
    setIssueHistoryNotificationEnabled,
  ] = useState(true);
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [chatId, setChatId] = useState("-4871143154");
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const token = localStorage.getItem("token");
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const settings = response.data;
      setWarningDays(settings.expirationWarningDays);
      setLowStockThreshold(settings.lowStockThreshold);
      setIssueStockNotificationEnabled(
        settings.issueStockNotificationEnabled || false,
      ); // Default to false if undefined
      setIssueHistoryNotificationEnabled(
        settings.issueHistoryNotificationEnabled || false,
      ); // Default to false if undefined
      setTelegramBotToken(settings.telegramBotToken || "");
      setChatId(settings.chatId || "-4871143154");
      console.log("Fetched Settings:", settings); // Debug
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
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
      console.log("Saving Notification Settings:", payload); // Debug
      const response = await axios.put(
        `${API_BASE_URL}/api/settings/notification`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Notification settings saved successfully");
      setIsNotificationModalOpen(false);
      await fetchSettings(); // รีเฟรช Settings หลังบันทึก
    } catch (error) {
      console.error("Error saving notification settings:", error);
      toast.error("Failed to save notification settings");
    }
  };

  const handleSaveTelegramConfig = () => {
    setIsTelegramModalOpen(true);
  };

  const handleConfirmSaveTelegram = async () => {
    try {
      // Always send all settings fields to avoid partial overwrite
      const payload = {
        expirationWarningDays: warningDays,
        lowStockThreshold,
        issueStockNotificationEnabled: isIssueStockNotificationEnabled,
        issueHistoryNotificationEnabled: isIssueHistoryNotificationEnabled,
        telegramBotToken,
        chatId,
      };
      console.log("Saving Telegram Config:", payload); // Debug
      // Use the same endpoint as notification to update all settings at once
      const response = await axios.put(
        `${API_BASE_URL}/api/settings/notification`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Telegram configuration saved successfully");
      setIsTelegramModalOpen(false);
      await fetchSettings(); // รีเฟรช Settings หลังบันทึก
    } catch (error) {
      console.error("Error saving telegram configuration:", error);
      toast.error("Failed to save telegram configuration");
    }
  };

  const handleCancelSave = (modalType) => {
    if (modalType === "notification") setIsNotificationModalOpen(false);
    if (modalType === "telegram") setIsTelegramModalOpen(false);
  };

  return (
    <div className="mx-auto max-w-screen rounded-xl bg-gray-50 p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Settings</h1>
      <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {/* Expiration Warning and Low Stock Threshold */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Expiration Warning Days
          </label>
          <input
            type="number"
            value={warningDays}
            onChange={(e) => setWarningDays(Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
            min="1"
          />
        </div>
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Low Stock Threshold
          </label>
          <input
            type="number"
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
            min="1"
          />
        </div>

        {/* Notification Settings */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Notification Settings
          </label>
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={isIssueStockNotificationEnabled}
                onChange={(e) =>
                  setIssueStockNotificationEnabled(e.target.checked)
                }
                className="mr-2 leading-tight"
              />
              <span>Enable Issue Stock Notifications</span>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={isIssueHistoryNotificationEnabled}
                onChange={(e) =>
                  setIssueHistoryNotificationEnabled(e.target.checked)
                }
                className="mr-2 leading-tight"
              />
              <span>Enable Issue History Notifications</span>
            </div>
            <button
              onClick={handleSaveNotificationSettings}
              className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Save Notification Settings
            </button>
          </div>
        </div>

        {/* Telegram Configuration */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Telegram Configuration
          </label>
          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                Telegram Bot Token
              </label>
              <input
                type="text"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter Telegram Bot Token"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                Chat ID
              </label>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter Chat ID (e.g., -4871143154)"
              />
            </div>
            <button
              onClick={handleSaveTelegramConfig}
              className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Save Telegram Configuration
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isNotificationModalOpen}
        onRequestClose={() => handleCancelSave("notification")}
        style={{
          content: {
            top: "50%",
            left: "50%",
            right: "auto",
            bottom: "auto",
            marginRight: "-50%",
            transform: "translate(-50%, -50%)",
            width: "300px",
            padding: "20px",
          },
        }}
      >
        <h2 className="mb-4 text-lg font-bold">
          Confirm Save Notification Settings
        </h2>
        <p>Are you sure you want to save these notification settings?</p>
        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={() => handleCancelSave("notification")}
            className="rounded-md bg-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSaveNotification}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isTelegramModalOpen}
        onRequestClose={() => handleCancelSave("telegram")}
        style={{
          content: {
            top: "50%",
            left: "50%",
            right: "auto",
            bottom: "auto",
            marginRight: "-50%",
            transform: "translate(-50%, -50%)",
            width: "300px",
            padding: "20px",
          },
        }}
      >
        <h2 className="mb-4 text-lg font-bold">
          Confirm Save Telegram Configuration
        </h2>
        <p>Are you sure you want to save these telegram settings?</p>
        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={() => handleCancelSave("telegram")}
            className="rounded-md bg-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSaveTelegram}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Settings;
