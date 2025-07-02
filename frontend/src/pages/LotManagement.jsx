import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { FaSearch, FaChevronLeft, FaChevronRight, FaTrash, FaEdit, FaPlus } from 'react-icons/fa';
import { FiDownload } from 'react-icons/fi';
import * as Select from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const LotManagement = () => {
  const [lots, setLots] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  // input state สำหรับฟอร์ม
  const [inputSearch, setInputSearch] = useState('');
  const [inputWarehouse, setInputWarehouse] = useState('all');
  // query state สำหรับ fetch
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouse, setWarehouse] = useState('all');
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin] = useState(localStorage.getItem('token') ? JSON.parse(atob(localStorage.getItem('token').split('.')[1])).role === 'admin' : false);
  const [editLot, setEditLot] = useState(null);

  useEffect(() => {
    fetchWarehouses();
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

  const fetchLots = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('http://localhost:3000/api/lot-management', {
        headers: { Authorization: `Bearer ${token}` },
        params: { searchQuery, warehouse, page, limit }
      });
      // ตรวจสอบและเพิ่ม expanded
      const enrichedLots = data.data.map(lot => {
        console.log('Lot data:', lot); // ดีบั๊กข้อมูล
        return {
          ...lot,
          expanded: true, // ตั้งค่าเริ่มต้นเป็น true เพื่อให้ตารางแสดง
          totalQty: (lot.qtyOnHand || 0) + (lot.damaged || 0), // แสดง qtyOnHand + damaged
          availableQty: (lot.qtyOnHand || 0) - (lot.damaged || 0)
        };
      });
      setLots(enrichedLots);
      setTotal(data.total);
    } catch (error) {
      console.error('Error fetching lots:', error);
      toast.error('Failed to load lots');
    } finally {
      setIsLoading(false);
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
    setEditLot({ ...lot, productionDate: lot.productionDate ? new Date(lot.productionDate) : null, expDate: lot.expDate ? new Date(lot.expDate) : null });
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
      } catch (error) {
        console.error('Error deleting lot:', error);
        toast.error('Failed to delete lot');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const isExpired = (expDate) => {
    return new Date(expDate) < new Date();
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

  return (
    <div className="p-6 max-w-screen mx-auto bg-gray-50 rounded-xl">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Lot Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and track all lots in the inventory</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <button
            onClick={handleExport}
            className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            disabled={isLoading}
          >
            <FiDownload className="mr-2" /> Export to Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <form onSubmit={handleSearch} className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Search</label>
            <div className="relative">
              <input
                type="text"
                value={inputSearch}
                onChange={(e) => setInputSearch(e.target.value)}
                placeholder="Search by Lot Code, Product Name or Code Product..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Warehouse</label>
            <Select.Root value={inputWarehouse} onValueChange={setInputWarehouse} disabled={isLoading}>
              <Select.Trigger className="w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-lg">
                <Select.Value placeholder="All Warehouses" />
                <Select.Icon className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <ChevronDownIcon />
                </Select.Icon>
              </Select.Trigger>
              <Select.Content className="bg-white border border-gray-300 rounded-lg shadow-lg mt-1">
                <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-gray-100 text-gray-600">
                  <ChevronUpIcon />
                </Select.ScrollUpButton>
                <Select.Viewport>
                  <Select.Group>
                    <Select.Item value="all" className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 focus:bg-blue-100">
                      <Select.ItemText>All Warehouses</Select.ItemText>
                    </Select.Item>
                    {warehouses.map(w => (
                      <Select.Item key={w._id} value={w.name} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 focus:bg-blue-100">
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
          <div className="flex items-end space-x-2">
            <button
              type="submit"
              className="flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              disabled={isLoading}
            >
              <FaSearch className="mr-2" /> Search
            </button>
            {(searchQuery || warehouse !== 'all') && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center justify-center px-3 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={isLoading}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            {Object.entries(lots.reduce((acc, lot) => {
              const productName = lot.productId?.name || 'Unknown';
              if (!acc[productName]) acc[productName] = [];
              acc[productName].push(lot);
              return acc;
            }, {})).map(([productName, productLots]) => (
              <div key={productName} className="mb-4">
                <div
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-t-lg cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    setLots(prev => prev.map(l => {
                      if (l.productId?.name === productName) return { ...l, expanded: !l.expanded };
                      return l;
                    }));
                  }}
                >
                  <h3 className="text-lg font-medium text-gray-900">{productName} ({productLots[0].productId?.productCode || 'N/A'})</h3>
                  <span>{productLots.length} lots</span>
                </div>
                {productLots.length > 0 && (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot Code</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code Product</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warehouse</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Production Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiration Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Qty</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Damaged</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available Qty</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expire</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {productLots.map(lot => (
                        <tr key={lot._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {lot.lotCode}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lot.productId?.productCode || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lot.warehouse}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lot.productionDate ? format(new Date(lot.productionDate), 'dd-MM-yyyy') : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lot.expDate ? format(new Date(lot.expDate), 'dd-MM-yyyy') : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <input
                              type="number"
                              value={lot.totalQty || 0} // เปลี่ยนเป็น totalQty
                              onChange={(e) => {
                                if (isAdmin) {
                                  const newValue = Number(e.target.value);
                                  setLots(prev => prev.map(l => l._id === lot._id ? { ...l, totalQty: newValue, availableQty: newValue - (l.damaged || 0) } : l));
                                }
                              }}
                              className={`w-full p-1 border rounded ${!isAdmin ? 'bg-gray-100' : 'bg-white focus:ring-blue-500'}`}
                              disabled={!isAdmin}
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <input
                              type="number"
                              value={lot.damaged || 0}
                              onChange={(e) => {
                                if (isAdmin) {
                                  const newValue = Number(e.target.value) >= 0 ? Number(e.target.value) : 0;
                                  setLots(prev => prev.map(l => l._id === lot._id ? { ...l, damaged: newValue, availableQty: l.totalQty - newValue } : l));
                                }
                              }}
                              className={`w-full p-1 border rounded ${!isAdmin ? 'bg-gray-100' : 'bg-white focus:ring-blue-500'}`}
                              disabled={!isAdmin}
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lot.qtyOnHand || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              isExpired(lot.expDate) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {isExpired(lot.expDate) ? 'Expired' : 'Active'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleEdit(lot)}
                                  className="text-blue-600 hover:text-blue-900 mr-2"
                                  disabled={isLoading}
                                >
                                  <FaEdit />
                                </button>
                                <button
                                  onClick={() => handleDelete(lot._id)}
                                  className="text-red-600 hover:text-red-900"
                                  disabled={isLoading}
                                >
                                  <FaTrash />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
          
          {lots.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
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
        </div>
      )}
      <ToastContainer />
    </div>
  );
};

export default LotManagement;