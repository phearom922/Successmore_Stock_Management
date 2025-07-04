import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
  FaTrash,
  FaEdit,
  FaPlus,
  FaFilter,
  FaTimes,
  FaExclamationTriangle
} from 'react-icons/fa';
import { FiDownload } from 'react-icons/fi';
import * as Select from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';




const ExpiringNotification = ({ lots, warningDays, onClose }) => {
  const daysLeft = (expDate) => {
    const diff = new Date(expDate) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };
  return (
    <div className="fixed top-4 right-4 z-50 w-full max-w-md">
      <div className="bg-white rounded-xl shadow-lg border border-yellow-200 overflow-hidden">
        <div className="flex items-start justify-between bg-yellow-50 px-4 py-3 border-b border-yellow-100">
          <div className="flex items-center gap-2">
            <FaExclamationTriangle className="text-yellow-500 text-lg" />
            <h3 className="font-bold text-gray-800">Expiration Alert</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close notification"
          >
            <FaTimes />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-gray-600 mb-3">
            {lots.length} {lots.length === 1 ? 'item' : 'items'} expiring within {warningDays} days
          </p>

          {lots.map((lot) => (
            <div key={lot._id} className="mb-3 last:mb-0 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-900">{lot.lotCode} - {lot.productId?.name}</p>
                  <p className="text-sm text-gray-600">Exp: {format(new Date(lot.expDate), 'dd/MM/yyyy')}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${daysLeft(lot.expDate) <= 7 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                  {daysLeft(lot.expDate)} days
                </span>
              </div>
              <div className="mt-2 flex justify-between items-center">
                <span className="text-sm text-gray-600">Quantity:</span>
                <span className="font-medium">{lot.qtyOnHand || 0}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};























const LotManagement = () => {
  const [lots, setLots] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [inputSearch, setInputSearch] = useState('');
  const [inputWarehouse, setInputWarehouse] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouse, setWarehouse] = useState('all');
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin] = useState(() => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload?.role === 'admin';
    } catch {
      return false;
    }
  });
  const [editLot, setEditLot] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expiringLots, setExpiringLots] = useState([]);
  const [warningDays, setWarningDays] = useState(15);

  useEffect(() => {
    fetchWarehouses();
    checkExpiringLots();
    fetchSettings();
  }, []);

  useEffect(() => {
    fetchLots();
  }, [searchQuery, warehouse, page]);

  const fetchWarehouses = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('http://localhost:3000/api/warehouses', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWarehouses(data);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      toast.error('Failed to load warehouses');
    }
  };








  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('http://localhost:3000/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWarningDays(data.expirationWarningDays);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    }
  };


  const fetchLots = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('http://localhost:3000/api/lot-management', {
        headers: { Authorization: `Bearer ${token}` },
        params: { searchQuery, warehouse, page, limit }
      });
      const enrichedLots = data.data.map(lot => ({
        ...lot,
        expanded: true,
        totalQty: (lot.qtyOnHand || 0) + (lot.damaged || 0),
        availableQty: (lot.qtyOnHand || 0) - (lot.damaged || 0)
      }));
      setLots(enrichedLots);
      setTotal(data.total);
    } catch (error) {
      console.error('Error fetching lots:', error);
      toast.error('Failed to load lots');
    } finally {
      setIsLoading(false);
    }
  };

  const [showExpiringAlert, setShowExpiringAlert] = useState(false);

  const checkExpiringLots = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('http://localhost:3000/api/lot-management/expiring', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExpiringLots(data.expiringLots);
      setWarningDays(data.warningDays || 15);
      if (data.expiringLots.length > 0) {
        setShowExpiringAlert(true);
      }
    } catch (error) {
      console.error('Error checking expiring lots:', error);
      toast.error('Failed to check expiring lots');
    }
  };


  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:3000/api/lot-management/export', {
        headers: { Authorization: `Bearer ${token}` },
        params: { searchQuery, warehouse },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `lot-management-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

  const handleEdit = (lot) => {
    if (!isAdmin) return;
    setEditLot({
      ...lot,
      productionDate: lot.productionDate ? new Date(lot.productionDate) : null,
      expDate: lot.expDate ? new Date(lot.expDate) : null
    });
  };

  const handleSaveEdit = async () => {
    if (!isAdmin || !editLot) return;
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:3000/api/lot-management/${editLot._id}`, {
        ...editLot,
        productionDate: editLot.productionDate?.toISOString(),
        expDate: editLot.expDate?.toISOString(),
        quantity: Number(editLot.quantity),
        damaged: Number(editLot.damaged)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Lot updated successfully');
      setEditLot(null);
      fetchLots();
      checkExpiringLots(); // อัปเดตการแจ้งเตือนหลังแก้ไข
    } catch (error) {
      console.error('Error updating lot:', error);
      toast.error('Failed to update lot');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (lotId) => {
    if (!isAdmin) return;
    if (window.confirm('Are you sure you want to delete this lot?')) {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`http://localhost:3000/api/lot-management/${lotId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Lot deleted successfully');
        fetchLots();
        checkExpiringLots(); // อัปเดตการแจ้งเตือนหลังลบ
      } catch (error) {
        console.error('Error deleting lot:', error);
        toast.error('Failed to delete lot');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const isExpired = (expDate) => {
    return expDate && new Date(expDate) < new Date();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchQuery(inputSearch);
    setWarehouse(inputWarehouse);
    setPage(1);
  };

  const clearFilters = () => {
    setInputSearch('');
    setInputWarehouse('all');
    setSearchQuery('');
    setWarehouse('all');
    setPage(1);
  };

  const toggleProductGroup = (productName) => {
    setLots(prev => prev.map(l => {
      if (l.productId?.name === productName) return { ...l, expanded: !l.expanded };
      return l;
    }));
  };

  return (
    <div className="p-4 md:p-6 mx-auto bg-gray-50 min-h-screen">
      {showExpiringAlert && (
        <ExpiringNotification
          lots={expiringLots}
          warningDays={warningDays}
          onClose={() => setShowExpiringAlert(false)}
        />
      )}




      <div className="max-w-screen-2xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Lot Management</h1>
            <p className="text-sm text-gray-500 mt-1">Track and manage inventory lots</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FaFilter className="mr-2" /> Filters
            </button>
            <button
              onClick={handleExport}
              className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              disabled={isLoading}
            >
              <FiDownload className="mr-2" /> Export
            </button>
          </div>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-800">Filters</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Search</label>
                <div className="relative">
                  <input
                    type="text"
                    value={inputSearch}
                    onChange={(e) => setInputSearch(e.target.value)}
                    placeholder="Lot code, product name..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    disabled={isLoading}
                  />
                  <FaSearch className="absolute left-3 top-3 text-gray-400" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Warehouse</label>
                <Select.Root value={inputWarehouse} onValueChange={setInputWarehouse} disabled={isLoading}>
                  <Select.Trigger className="w-full pl-3 pr-10 py-2.5 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg transition">
                    <Select.Value placeholder="All Warehouses" />
                    <Select.Icon className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <ChevronDownIcon />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Content className="bg-white border border-gray-300 rounded-lg shadow-lg mt-1 z-50">
                    <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-gray-100 text-gray-600">
                      <ChevronUpIcon />
                    </Select.ScrollUpButton>
                    <Select.Viewport className="p-1">
                      <Select.Group>
                        <Select.Item value="all" className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer">
                          <Select.ItemText>All Warehouses</Select.ItemText>
                        </Select.Item>
                        {warehouses.map(w => (
                          <Select.Item key={w._id} value={w.name} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer">
                            <Select.ItemText>{w.name}</Select.ItemText>
                            <Select.ItemIndicator className="absolute right-2 inline-flex items-center">
                              <CheckIcon />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-gray-100 text-gray-600">
                      <ChevronDownIcon />
                    </Select.ScrollDownButton>
                  </Select.Content>
                </Select.Root>
              </div>
              <div className="flex items-end gap-2 mb-2">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  disabled={isLoading}
                >
                  <FaSearch className="mr-2" /> Apply
                </button>
                {(searchQuery || warehouse !== 'all') && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex items-center justify-center px-3 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition"
                    disabled={isLoading}
                  >
                    Clear
                  </button>
                )}
              </div>


            </form>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
            {/* Product Groups */}
            {Object.entries(lots.reduce((acc, lot) => {
              const productName = lot.productId?.name || 'Unknown';
              if (!acc[productName]) acc[productName] = [];
              acc[productName].push(lot);
              return acc;
            }, {})).map(([productName, productLots]) => (
              <div key={productName} className="mb-1 last:mb-0">
                {/* Product Header */}
                <div
                  className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition"
                  onClick={() => toggleProductGroup(productName)}
                >
                  <div className="flex items-center">
                    <h3 className="text-lg font-medium text-gray-900">{productName}</h3>
                    <span className="ml-2 text-sm text-gray-500">
                      ({productLots[0].productId?.productCode || 'N/A'})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-gray-200 rounded-full text-xs font-medium">
                      {productLots.length} lots
                    </span>
                    <ChevronDownIcon className={`transform transition ${productLots[0].expanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Product Lots Table */}
                {productLots[0].expanded && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot Code</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warehouse</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Production</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiration</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Damaged</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">qtyOnHand</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          {isAdmin && (
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {productLots.map(lot => (
                          <tr key={lot._id} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {lot.lotCode}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {lot.warehouse}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {lot.productionDate ? format(new Date(lot.productionDate), 'dd/MM/yyyy') : 'N/A'}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {lot.expDate ? format(new Date(lot.expDate), 'dd/MM/yyyy') : 'N/A'}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              <input
                                type="number"
                                value={lot.totalQty || 0}
                                onChange={(e) => {
                                  if (isAdmin) {
                                    const newValue = Number(e.target.value);
                                    setLots(prev => prev.map(l => l._id === lot._id ? {
                                      ...l,
                                      totalQty: newValue,
                                      availableQty: newValue - (l.damaged || 0)
                                    } : l));
                                  }
                                }}
                                className={`w-20 p-1 border rounded ${!isAdmin ? 'bg-gray-100' : 'bg-white focus:ring-blue-500'}`}
                                disabled={!isAdmin}
                              />
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              <input
                                type="number"
                                value={lot.damaged || 0}
                                onChange={(e) => {
                                  if (isAdmin) {
                                    const newValue = Number(e.target.value) >= 0 ? Number(e.target.value) : 0;
                                    setLots(prev => prev.map(l => l._id === lot._id ? {
                                      ...l,
                                      damaged: newValue,
                                      availableQty: l.totalQty - newValue
                                    } : l));
                                  }
                                }}
                                className={`w-20 p-1 border rounded ${!isAdmin ? 'bg-gray-100' : 'bg-white focus:ring-blue-500'}`}
                                disabled={!isAdmin}
                              />
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {lot.qtyOnHand || 0}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${isExpired(lot.expDate) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                }`}>
                                {isExpired(lot.expDate) ? 'Expired' : 'Active'}
                              </span>
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => handleEdit(lot)}
                                    className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                                    disabled={isLoading}
                                    title="Edit"
                                  >
                                    <FaEdit />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(lot._id)}
                                    className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                                    disabled={isLoading}
                                    title="Delete"
                                  >
                                    <FaTrash />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            {lots.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-500">
                  Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, total)}</span> of <span className="font-medium">{total}</span> results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className={`p-2 rounded-md ${page === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    <FaChevronLeft />
                  </button>
                  <span className="px-3 py-1 bg-gray-100 rounded-md text-sm text-gray-700">
                    Page {page} of {Math.ceil(total / limit)}
                  </span>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page * limit >= total}
                    className={`p-2 rounded-md ${page * limit >= total ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    <FaChevronRight />
                  </button>
                </div>
              </div>
            )}

            {/* Empty State */}
            {lots.length === 0 && !isLoading && (
              <div className="p-8 text-center">
                <div className="text-gray-400 mb-2">No lots found</div>
                <button
                  onClick={clearFilters}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <ToastContainer position="bottom-right" autoClose={3000} />
    </div>
  );
};

export default LotManagement;