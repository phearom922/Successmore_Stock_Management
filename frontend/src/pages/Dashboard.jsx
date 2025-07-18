import { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import {
  FaBoxes, FaWarehouse, FaExclamationTriangle, FaCalendarTimes, FaLayerGroup,
  FaBoxOpen, FaChartBar, FaCog, FaChevronDown
} from 'react-icons/fa';
import { FaCube } from 'react-icons/fa'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalLots: 0,
    totalWarehouses: 0,
    lowStockAlerts: 0,
    expiringSoon: 0
  });
  const [recentDamages, setRecentDamages] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    expirationWarningDays: 15,
    lowStockThreshold: 10
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const user = token ? JSON.parse(atob(token.split('.')[1])) : null;
  const userRole = user?.role || 'user';

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        toast.error('Session expired, please login again');
        navigate('/login');
        return;
      }
    } catch {
      localStorage.removeItem('token');
      toast.error('Invalid token, please login again');
      navigate('/login');
      return;
    }

    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        // Fetch warehouses first
        const warehousesRes = await axios.get('http://localhost:3000/api/warehouses', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setWarehouses(warehousesRes.data);

        // If user is not admin and has a warehouse assigned, set it as default
        if (userRole !== 'admin' && user?.warehouse) {
          setSelectedWarehouse(user.warehouse);
        }

        // Fetch other data
        await fetchDashboardData(userRole !== 'admin' && user?.warehouse ? user.warehouse : selectedWarehouse);
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
      if (warehouseId && warehouseId !== 'all') {
        params.warehouse = warehouseId;
      }

      const [
        productsRes,
        lotsRes,
        warehousesRes,
        expiringRes,
        damagesRes,
      ] = await Promise.all([
        axios.get('http://localhost:3000/api/products', {
          headers: { Authorization: `Bearer ${token}` },
          params
        }),
        axios.get('http://localhost:3000/api/lots', {
          headers: { Authorization: `Bearer ${token}` },
          params
        }),
        axios.get('http://localhost:3000/api/warehouses', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:3000/api/lot-management/expiring', {
          headers: { Authorization: `Bearer ${token}` },
          params
        }),
        axios.get('http://localhost:3000/api/manage-damage/history', {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            ...params,
            limit: 5,
            sort: 'desc'
          }
        }),
      ]);

      // Calculate low stock products and lots per warehouse
      let lowStockLots = [];
      let expiringLots = [];
      if (warehouseId === 'all') {
        lowStockLots = lotsRes.data.filter(lot => {
          const totalQty = lot.qtyOnHand ?? lot.quantity ?? 0;
          return totalQty < settings.lowStockThreshold;
        });
        expiringLots = expiringRes.data.expiringLots || [];
      } else {
        lowStockLots = lotsRes.data.filter(lot => {
          const totalQty = lot.qtyOnHand ?? lot.quantity ?? 0;
          return totalQty < settings.lowStockThreshold && lot.warehouse === warehouseId;
        });
        expiringLots = (expiringRes.data.expiringLots || []).filter(lot => lot.warehouse === warehouseId);
      }

      // Summary by warehouse + product code (like Summary tab)
      const summaryMap = {};
      lotsRes.data.forEach(lot => {
        const warehouse = warehousesRes.data.find(w => w._id === lot.warehouse)?.name || 'N/A';
        const productCode = lot.productId?.productCode || lot.productCode || 'N/A';
        const productName = lot.productId?.name || lot.productName || 'N/A';
        if (!summaryMap[warehouse]) summaryMap[warehouse] = {};
        if (!summaryMap[warehouse][productCode]) {
          summaryMap[warehouse][productCode] = {
            productName,
            total: 0
          };
        }
        summaryMap[warehouse][productCode].total += (lot.qtyOnHand || lot.quantity || 0) + (lot.damaged || 0);
      });
      // Flatten and sort by total desc
      const summaryRows = [];
      Object.entries(summaryMap).forEach(([warehouse, products]) => {
        Object.entries(products).forEach(([productCode, info]) => {
          summaryRows.push({
            warehouse,
            productCode,
            productName: info.productName,
            total: info.total
          });
        });
      });
      summaryRows.sort((a, b) => b.total - a.total);

      setStats({
        totalProducts: productsRes.data.length,
        totalLots: lotsRes.data.length,
        totalWarehouses: warehousesRes.data.length,
        lowStockAlerts: lowStockLots.length,
        expiringSoon: expiringLots.length
      });

      setRecentDamages(
        (userRole !== 'admin' && user?.warehouse)
          ? damagesRes.data.filter(damage => damage.lotId?.warehouse === user.warehouse).slice(0, 5)
          : damagesRes.data.slice(0, 5)
      );
      setTopProducts(summaryRows.slice(0, 5));
    } catch (error) {
      handleFetchError(error);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettings(res.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Use default settings if API fails
      setSettings({
        expirationWarningDays: 15,
        lowStockThreshold: 10
      });
    }
  };

  const updateSettings = async () => {
    try {
      await axios.put('http://localhost:3000/api/settings', settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Settings updated successfully');
      setShowSettingsModal(false);
      fetchDashboardData(selectedWarehouse); // Refresh data with new settings
    } catch (error) {
      toast.error('Failed to update settings');
      console.error('Error updating settings:', error);
    }
  };

  const handleFetchError = (error) => {
    if (error.response?.status === 401) {
      toast.error('Session expired, please login again');
      navigate('/login');
    } else {
      toast.error('Failed to load dashboard data');
      console.error('Dashboard error:', error);
    }
  };

  const handleWarehouseChange = (value) => {
    setSelectedWarehouse(value);
    fetchDashboardData(value);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-screen-2xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory Dashboard</h1>
            <p className="text-muted-foreground">Warehouse Management System Overview</p>
          </div>
          <div className="flex items-center space-x-4">
            {(userRole === 'admin' || warehouses.length > 1) && userRole === 'admin' ? (
              <div className="flex items-center space-x-4">
                <Select value={selectedWarehouse} onValueChange={handleWarehouseChange}>
                  <SelectTrigger className="w-[220px] bg-white border border-gray-300 rounded-lg py-2 pl-4 pr-4 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Warehouses</SelectItem>
                    {warehouses.map(warehouse => (
                      <SelectItem key={warehouse._id} value={warehouse._id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : userRole !== 'admin' && user?.warehouse ? (
              <div className="flex items-center space-x-2">
                <span className="px-4 py-2 bg-gray-100 rounded-lg text-gray-700 font-medium">
                  {warehouses.find(w => w._id === user.warehouse)?.name || 'Warehouse'}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Stats Cards */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              {/* Total Products */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Products</p>
                    <p className="text-3xl font-bold text-gray-800 mt-2">{stats.totalProducts}</p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-50 text-blue-600">
                    <FaBoxes size={24} />
                  </div>
                </div>
              </div>

              {/* Total Warehouses */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Warehouses</p>
                    <p className="text-3xl font-bold text-gray-800 mt-2">{stats.totalWarehouses}</p>
                  </div>
                  <div className="p-3 rounded-full bg-purple-50 text-purple-600">
                    <FaWarehouse size={24} />
                  </div>
                </div>
              </div>

              {/* Low Stock Alert */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Low Stock Alert</p>
                    <p className="text-3xl font-bold text-gray-800 mt-2">{stats.lowStockAlerts}</p>
                    <p className="text-xs text-gray-500 mt-1">Threshold: {settings.lowStockThreshold}</p>
                  </div>
                  <div className="p-3 rounded-full bg-yellow-50 text-yellow-600">
                    <FaExclamationTriangle size={24} />
                  </div>
                </div>
              </div>

              {/* Expiring Soon */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Expiring Soon</p>
                    <p className="text-3xl font-bold text-gray-800 mt-2">{stats.expiringSoon}</p>
                    <p className="text-xs text-gray-500 mt-1">Within {settings.expirationWarningDays} days</p>
                  </div>
                  <div className="p-3 rounded-full bg-red-50 text-red-600">
                    <FaCalendarTimes size={24} />
                  </div>
                </div>
              </div>

              {/* Total Lots */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Lots</p>
                    <p className="text-3xl font-bold text-gray-800 mt-2">{stats.totalLots}</p>
                  </div>
                  <div className="p-3 rounded-full bg-green-50 text-green-600">
                    <FaLayerGroup size={24} />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Damages and Top Products */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Damage Records */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                    <FaBoxOpen className="mr-2 text-blue-600" />
                    Recent Damage Records
                  </h2>
                  <span className="text-sm text-gray-500">Last 5 records</span>
                </div>

                <div className="space-y-3">
                  {recentDamages.length > 0 ? (
                    recentDamages.map((damage, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center bg-gray-50 hover:bg-gray-100 px-4 py-3 rounded-lg shadow-sm"
                      >
                        {/* Left Side: Product and Lot */}
                        <div className="flex flex-col">
                          <div className="font-semibold text-gray-800">
                            {damage.lotId?.productId?.name} ({damage.lotId?.productId?.productCode})
                          </div>
                          <div className="text-sm text-gray-500">Lot: {damage.lotId?.lotCode}</div>
                        </div>

                        {/* Center: Reason */}
                        <div className="text-sm text-gray-600 max-w-[160px] text-center truncate">
                          {damage.reason || 'No reason'}
                        </div>

                        {/* Right: Quantity */}
                        <div className="text-sm font-bold text-red-600">
                          -{damage.quantity} pcs
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      No damage records found
                    </div>
                  )}
                </div>
              </div>


              {/* Top 5 Products by Stock (Leaderboard Style) */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                    <FaCube className="mr-2 text-green-600" />
                    Top 5 Products by Stock (Summary by Warehouse)
                  </h2>
                </div>
                <div className="space-y-3">
                  {topProducts.length > 0 ? (
                    topProducts.map((product, idx) => (
                      <div
                        key={product.warehouse + '-' + product.productCode + '-' + idx}
                        className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-lg px-4 py-3 shadow-sm"
                      >
                        <div className="flex items-center space-x-4">
                          {/* Rank Badge */}
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold flex items-center justify-center">
                            #{idx + 1}
                          </div>

                          {/* Product Info */}
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-800">{product.productCode}</span>
                            <span className="text-sm text-gray-500">{product.productName}</span>
                            <span className="text-xs text-gray-400">{product.warehouse}</span>
                          </div>
                        </div>

                        {/* Total Stock */}
                        <div className="text-green-600 font-bold text-sm">{product.total} units</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      No product data available
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">System Settings</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Low Stock Threshold
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.lowStockThreshold}
                  onChange={(e) => setSettings({ ...settings, lowStockThreshold: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration Warning Days
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.expirationWarningDays}
                  onChange={(e) => setSettings({ ...settings, expirationWarningDays: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={updateSettings}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Dashboard;