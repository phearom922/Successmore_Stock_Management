import { useState, useEffect } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBoxes,
  FaWarehouse,
  FaExclamationTriangle,
  FaCalendarTimes,
  FaLayerGroup,
  FaBoxOpen,
  FaCube,
} from "react-icons/fa";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Animation variants
const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      when: "beforeChildren",
      staggerChildren: 0.2,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4 },
  },
};

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalLots: 0,
    totalWarehouses: 0,
    lowStockAlerts: 0,
    expiringSoon: 0,
  });
  const [recentDamages, setRecentDamages] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState({
    expirationWarningDays: 15,
    lowStockThreshold: 10,
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [lowStockLotCount, setLowStockLotCount] = useState(0);
  const [expiringLotCount, setExpiringLotCount] = useState(0);
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const user = token ? JSON.parse(atob(token.split(".")[1])) : null;
  const userRole = user?.role || "user";

  useEffect(() => {
    if (!token) {
      navigate("/login", { state: { message: "Please login to continue" } });
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem("token");
        // toast.error('Session expired, please login again');
        navigate("/login");
        return;
      }
    } catch {
      localStorage.removeItem("token");
      // toast.error('Invalid token, please login again');
      navigate("/login");
      return;
    }

    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const warehousesRes = await axios.get(
          `${API_BASE_URL}/api/warehouses`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setWarehouses(warehousesRes.data);

        if (userRole === "admin" && user?.warehouse) {
          setSelectedWarehouse(user.warehouse);
        } else if (userRole !== "admin" && user?.warehouse) {
          setSelectedWarehouse(user.warehouse);
        }

        await fetchDashboardData(
          user?.warehouse ? user.warehouse : selectedWarehouse,
        );
        await fetchSettings();
      } catch (error) {
        handleFetchError(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [token, navigate]);

  const fetchDashboardData = async (warehouseId) => {
    try {
      const params = {};
      if (warehouseId && warehouseId !== "all") {
        params.warehouse = warehouseId;
      }

      const [productsRes, lotsRes, warehousesRes, expiringRes, damagesRes] =
        await Promise.all([
          axios.get(`${API_BASE_URL}/api/products`, {
            headers: { Authorization: `Bearer ${token}` },
            params,
          }),
          axios.get(`${API_BASE_URL}/api/lots`, {
            headers: { Authorization: `Bearer ${token}` },
            params,
          }),
          axios.get(`${API_BASE_URL}/api/warehouses`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_BASE_URL}/api/lot-management/expiring`, {
            headers: { Authorization: `Bearer ${token}` },
            params,
          }),
          axios.get(`${API_BASE_URL}/api/manage-damage/history`, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              ...params,
              limit: 5,
              sort: "desc",
            },
          }),
        ]);

      let lowStockLots = [];
      let expiringLots = [];
      if (warehouseId === "all") {
        lowStockLots = lotsRes.data.filter((lot) => {
          const totalQty = lot.qtyOnHand ?? lot.quantity ?? 0;
          return totalQty < settings.lowStockThreshold;
        });
        expiringLots = expiringRes.data.expiringLots || [];
      } else {
        lowStockLots = lotsRes.data.filter((lot) => {
          const totalQty = lot.qtyOnHand ?? lot.quantity ?? 0;
          return (
            totalQty < settings.lowStockThreshold &&
            lot.warehouse === warehouseId
          );
        });
        expiringLots = (expiringRes.data.expiringLots || []).filter(
          (lot) => lot.warehouse === warehouseId,
        );
      }

      const summaryMap = {};
      lotsRes.data.forEach((lot) => {
        const warehouse =
          warehousesRes.data.find((w) => w._id === lot.warehouse)?.name ||
          "N/A";
        const productCode =
          lot.productId?.productCode || lot.productCode || "N/A";
        const productName = lot.productId?.name || lot.productName || "N/A";
        if (!summaryMap[warehouse]) summaryMap[warehouse] = {};
        if (!summaryMap[warehouse][productCode]) {
          summaryMap[warehouse][productCode] = {
            productName,
            total: 0,
          };
        }
        summaryMap[warehouse][productCode].total +=
          (lot.qtyOnHand || lot.quantity || 0) + (lot.damaged || 0);
      });

      const summaryRows = [];
      Object.entries(summaryMap).forEach(([warehouse, products]) => {
        Object.entries(products).forEach(([productCode, info]) => {
          summaryRows.push({
            warehouse,
            productCode,
            productName: info.productName,
            total: info.total,
          });
        });
      });
      summaryRows.sort((a, b) => b.total - a.total);

      setStats({
        totalProducts: productsRes.data.length,
        totalLots: lotsRes.data.length,
        totalWarehouses: warehousesRes.data.length,
        lowStockAlerts: lowStockLots.length,
        expiringSoon: expiringLots.length,
      });

      setRecentDamages(
        Array.isArray(damagesRes.data) && damagesRes.data.length > 0
          ? damagesRes.data.slice(0, 5)
          : [],
      );
      setTopProducts(summaryRows.slice(0, 5));
      setLowStockLotCount(lowStockLots.length);
      setExpiringLotCount(expiringLots.length);
    } catch (error) {
      handleFetchError(error);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSettings(res.data);
    } catch (error) {
      console.error("Error fetching settings:", error);
      setSettings({
        expirationWarningDays: 15,
        lowStockThreshold: 10,
      });
    }
  };

  const updateSettings = async () => {
    try {
      await axios.put(`${API_BASE_URL}/api/settings`, settings, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Settings updated successfully");
      setShowSettingsModal(false);
      fetchDashboardData(selectedWarehouse);
    } catch (error) {
      toast.error("Failed to update settings");
      console.error("Error updating settings:", error);
    }
  };

  const handleFetchError = (error) => {
    if (error.response?.status === 401) {
      toast.error("Session expired, please login again");
      navigate("/login");
    } else {
      toast.error("Failed to load dashboard data");
      console.error("Dashboard error:", error);
    }
  };

  const handleWarehouseChange = (value) => {
    setSelectedWarehouse(value);
    fetchDashboardData(value);
  };

  return (
    <motion.div
      className="min-h-screen bg-gray-50 p-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="mx-auto max-w-screen-2xl">
        {/* Header */}
        <motion.div
          className="mb-8 flex items-center justify-between"
          variants={itemVariants}
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-800">
              Inventory Dashboard
            </h1>
            <p className="mt-1 text-gray-500">
              Warehouse Management System Overview
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Admin: dropdown เลือกได้ทุก warehouse, User: dropdown disabled เห็นเฉพาะ warehouse ตัวเอง */}
            {userRole === "admin" && (
              <motion.div variants={itemVariants}>
                <Select
                  value={selectedWarehouse}
                  onValueChange={handleWarehouseChange}
                >
                  <SelectTrigger className="w-[220px] rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-4 text-gray-700 transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse._id} value={warehouse._id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
            )}

            {userRole !== "admin" && user?.warehouse && (
              <motion.div variants={itemVariants}>
                <Select value={user.warehouse} disabled>
                  <SelectTrigger className="w-[220px] cursor-not-allowed rounded-lg border border-gray-300 bg-gray-100 py-2 pr-4 pl-4 text-gray-700">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses
                      .filter((w) => w._id === user.warehouse)
                      .map((warehouse) => (
                        <SelectItem key={warehouse._id} value={warehouse._id}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Loading State */}
        <AnimatePresence>
          {isLoading ? (
            <motion.div
              className="flex justify-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex flex-col items-center">
                <motion.div
                  className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                />
                <p className="mt-4 font-medium text-gray-600">
                  Loading Dashboard...
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div variants={containerVariants}>
              {/* Stats Cards */}
              <div
                className={`grid grid-cols-1 ${userRole === "admin" ? "lg:grid-cols-5" : "lg:grid-cols-4"} mb-8 gap-6 md:grid-cols-2`}
              >
                {/* Total Products */}
                <motion.div
                  className="rounded-xl border border-blue-300 bg-blue-50 p-6 transition-shadow duration-300 hover:shadow-md"
                  variants={cardVariants}
                  whileHover={{ scale: 1.03 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        Total Products
                      </p>
                      <motion.p
                        className="mt-2 text-3xl font-bold text-blue-800"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        {stats.totalProducts}
                      </motion.p>
                    </div>
                    <motion.div
                      className="rounded-full bg-blue-100 p-3 text-blue-600"
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.5 }}
                    >
                      <FaBoxes size={24} />
                    </motion.div>
                  </div>
                </motion.div>

                {/* Total Warehouses */}
                {userRole === "admin" && (
                  <motion.div
                    className="rounded-xl border border-green-300 bg-green-50 p-6 transition-shadow duration-300 hover:shadow-md"
                    variants={cardVariants}
                    whileHover={{ scale: 1.03 }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-800">
                          Total Warehouses
                        </p>
                        <motion.p
                          className="mt-2 text-3xl font-bold text-green-800"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                        >
                          {stats.totalWarehouses}
                        </motion.p>
                      </div>
                      <motion.div
                        className="rounded-full bg-green-100 p-3 text-green-600"
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                      >
                        <FaWarehouse size={24} />
                      </motion.div>
                    </div>
                  </motion.div>
                )}

                {/* Low Stock Alert */}
                <motion.div
                  className="rounded-xl border border-yellow-300 bg-yellow-50 p-6 transition-shadow duration-300 hover:shadow-md"
                  variants={cardVariants}
                  whileHover={{ scale: 1.03 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-yellow-800">
                        Low Stock Alert
                      </p>
                      <motion.p
                        className="mt-2 text-3xl font-bold text-yellow-800"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        {stats.lowStockAlerts}
                      </motion.p>
                      <p className="mt-1 text-xs text-yellow-800">
                        Threshold: {settings.lowStockThreshold}
                      </p>
                      <p className="mt-1 text-xs text-yellow-800">
                        Lots: {lowStockLotCount}
                      </p>
                    </div>
                    <motion.div
                      className="rounded-full bg-yellow-100 p-3 text-yellow-600"
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.5 }}
                    >
                      <FaExclamationTriangle size={24} />
                    </motion.div>
                  </div>
                </motion.div>

                {/* Expiring Soon */}
                <motion.div
                  className="rounded-xl border border-red-300 bg-red-50 p-6 transition-shadow duration-300 hover:shadow-md"
                  variants={cardVariants}
                  whileHover={{ scale: 1.03 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-800">
                        Expiring Soon
                      </p>
                      <motion.p
                        className="mt-2 text-3xl font-bold text-red-800"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        {stats.expiringSoon}
                      </motion.p>
                      <p className="mt-1 text-xs text-red-800">
                        Within {settings.expirationWarningDays} days
                      </p>
                      <p className="mt-1 text-xs text-red-800">
                        Lots: {expiringLotCount}
                      </p>
                    </div>
                    <motion.div
                      className="rounded-full bg-red-100 p-3 text-red-600"
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.5 }}
                    >
                      <FaCalendarTimes size={24} />
                    </motion.div>
                  </div>
                </motion.div>

                {/* Total Lots */}
                <motion.div
                  className="rounded-xl border border-green-300 bg-green-50 p-6 transition-shadow duration-300 hover:shadow-md"
                  variants={cardVariants}
                  whileHover={{ scale: 1.03 }}
                >
                  <div className="flex flex-1 items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        Total Lots
                      </p>
                      <motion.p
                        className="mt-2 text-3xl font-bold text-green-700"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        {stats.totalLots}
                      </motion.p>
                    </div>
                    <motion.div
                      className="rounded-full bg-green-100 p-3 text-green-600"
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.5 }}
                    >
                      <FaLayerGroup size={24} />
                    </motion.div>
                  </div>
                </motion.div>
              </div>

              {/* Recent Damages and Top Products */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Recent Damage Records */}
                <motion.div
                  className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
                  variants={cardVariants}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center text-lg font-semibold text-gray-800">
                      <FaBoxOpen className="mr-2 text-blue-600" />
                      Recent Damage Records
                    </h2>
                    <span className="text-sm text-gray-500">
                      Last 5 records
                    </span>
                  </div>
                  <div className="space-y-3">
                    <AnimatePresence>
                      {recentDamages.length > 0 ? (
                        recentDamages.map((damage, index) => (
                          <motion.div
                            key={index}
                            className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 transition-colors duration-200 hover:bg-red-100/50"
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                          >
                            <div className="flex flex-col">
                              <div className="font-semibold text-gray-800">
                                {damage.lotId?.productId?.name} (
                                {damage.lotId?.productId?.productCode})
                              </div>
                              <div className="text-sm text-gray-500">
                                Lot: {damage.lotId?.lotCode}
                              </div>
                            </div>
                            <div className="max-w-[160px] truncate text-center text-sm text-gray-600">
                              {damage.reason || "No reason"}
                            </div>
                            <div className="text-sm font-bold text-red-600">
                              -{damage.quantity} pcs
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <motion.div
                          className="py-8 text-center text-gray-400"
                          variants={itemVariants}
                        >
                          No damage records found
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                {/* Top 5 Products by Stock */}
                <motion.div
                  className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
                  variants={cardVariants}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center text-lg font-semibold text-gray-800">
                      <FaCube className="mr-2 text-green-600" />
                      Top 5 Products by Stock
                    </h2>
                  </div>
                  <div className="space-y-3">
                    <AnimatePresence>
                      {topProducts.length > 0 ? (
                        topProducts.map((product, idx) => (
                          <motion.div
                            key={
                              product.warehouse +
                              "-" +
                              product.productCode +
                              "-" +
                              idx
                            }
                            className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 shadow-sm transition-colors duration-200 hover:bg-gray-100"
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                          >
                            <div className="flex items-center space-x-4">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600">
                                #{idx + 1}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-800">
                                  {product.productCode}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {product.productName}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {product.warehouse}
                                </span>
                              </div>
                            </div>
                            <div className="text-sm font-bold text-green-600">
                              {product.total} units
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <motion.div
                          className="py-8 text-center text-gray-400"
                          variants={itemVariants}
                        >
                          No product data available
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <motion.div
            className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="mb-4 text-xl font-bold text-gray-800">
                System Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.lowStockThreshold}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        lowStockThreshold: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Expiration Warning Days
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.expirationWarningDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        expirationWarningDays: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <motion.button
                  onClick={updateSettings}
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Save Changes
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ToastContainer position="top-right" autoClose={3000} />
    </motion.div>
  );
};

export default Dashboard;
