import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaSearch, FaTimes, FaDownload } from 'react-icons/fa';

const StockReports = () => {
  const [data, setData] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const token = localStorage.getItem('token');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [currentTab, setCurrentTab] = useState('all-stock');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  useEffect(() => {
    fetchWarehouses();
    fetchData('all-stock');
  }, []);

  const fetchWarehouses = async () => {
    try {
      const { data } = await axios.get('http://localhost:3000/api/warehouses', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWarehouses(data);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      toast.error('Failed to load warehouses');
    }
  };

  const fetchData = async (type = null, customSearch = null, customWarehouse = null) => {
    setIsLoading(true);
    try {
      const tabType = type || currentTab || 'all-stock';
      const search = customSearch !== null ? customSearch : searchQuery;
      const warehouseVal = customWarehouse !== null ? customWarehouse : selectedWarehouse;
      const { data } = await axios.get('http://localhost:3000/api/stock-reports', {
        headers: { Authorization: `Bearer ${token}` },
        params: { type: tabType, warehouse: warehouseVal, search }
      });
      let sortedData = [...data.data];
      if (sortConfig.key) {
        sortedData.sort((a, b) => {
          const getValue = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : ''), obj);
          const aValue = getValue(a, sortConfig.key);
          const bValue = getValue(b, sortConfig.key);
          if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
          return 0;
        });
      }
      setData(sortedData);
    } catch (error) {
      console.error('Error fetching stock reports:', error);
      toast.error('Failed to load stock reports');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWarehouseChange = (value) => {
    setSelectedWarehouse(value);
    fetchData(currentTab, searchQuery, value);
  };

  const handleSearch = () => {
    fetchData(currentTab, searchQuery);
  };

  const handleClear = () => {
    setSearchQuery('');
    fetchData(currentTab, '');
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleExport = async (type) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:3000/api/stock-reports/export', {
        headers: { Authorization: `Bearer ${token}` },
        params: { type, warehouse: selectedWarehouse, search: searchQuery },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-report-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

  // Always derive sortedData from data and sortConfig
  let sortedData = [...data];
  if (sortConfig.key) {
    sortedData.sort((a, b) => {
      const getValue = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : ''), obj);
      const aValue = getValue(a, sortConfig.key);
      const bValue = getValue(b, sortConfig.key);
      if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });
  }
  const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="p-6 max-w-screen mx-auto bg-gray-50 rounded-xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Stock Reports</h1>
      <div className="mb-4 flex space-x-4">
        <div>
          <Select onValueChange={handleWarehouseChange} value={selectedWarehouse}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Warehouse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map(w => (
                <SelectItem key={w._id} value={w.name}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Product Code or Name..."
            className="p-2 border border-gray-300 rounded-md"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            type="button"
          >
            <FaSearch />
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            type="button"
          >
            <FaTimes />
          </button>
        </div>
      </div>
      <Tabs defaultValue="all-stock" onValueChange={val => { setCurrentTab(val); setCurrentPage(1); fetchData(val, searchQuery); }}>
        <TabsList>
          <TabsTrigger value="all-stock">All Stock</TabsTrigger>
          <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
          <TabsTrigger value="expiring-soon">Expiring Soon</TabsTrigger>
          <TabsTrigger value="damaged">Damaged</TabsTrigger>
        </TabsList>
        <TabsContent value="all-stock">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              <button
                onClick={() => handleExport('all-stock')}
                className="mb-4 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                disabled={isLoading}
              >
                <FaDownload className="mr-2" /> Export to Excel
              </button>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('lotCode')}>
                      Lot Code {sortConfig.key === 'lotCode' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('productId.name')}>
                      Product Name {sortConfig.key === 'productId.name' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('warehouse')}>
                      Warehouse {sortConfig.key === 'warehouse' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('productId.productCode')}>
                      Product Code {sortConfig.key === 'productId.productCode' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('qtyOnHand')}>
                      qtyOnHand {sortConfig.key === 'qtyOnHand' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('damaged')}>
                      Damaged {sortConfig.key === 'damaged' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('expDate')}>
                      Expiration Date {sortConfig.key === 'expDate' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedData.map(lot => (
                    <tr key={lot._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lot.lotCode}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.productId?.name || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.warehouse}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.productId?.productCode || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.qtyOnHand || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.damaged || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lot.expDate ? format(new Date(lot.expDate), 'dd-MM-yyyy') : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} results
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-md ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 bg-gray-100 rounded-md text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-md ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </TabsContent>
        <TabsContent value="low-stock">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              <button
                onClick={() => handleExport('low-stock')}
                className="mb-4 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                disabled={isLoading}
              >
                <FaDownload className="mr-2" /> Export to Excel
              </button>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('lotCode')}>
                      Lot Code {sortConfig.key === 'lotCode' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('productId.name')}>
                      Product Name {sortConfig.key === 'productId.name' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('warehouse')}>
                      Warehouse {sortConfig.key === 'warehouse' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('productId.productCode')}>
                      Product Code {sortConfig.key === 'productId.productCode' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('qtyOnHand')}>
                      qtyOnHand {sortConfig.key === 'qtyOnHand' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedData.map(lot => (
                    <tr key={lot._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lot.lotCode}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.productId?.name || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.warehouse}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.productId?.productCode || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.qtyOnHand || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} results
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-md ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 bg-gray-100 rounded-md text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-md ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </TabsContent>
        <TabsContent value="expiring-soon">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              <button
                onClick={() => handleExport('expiring-soon')}
                className="mb-4 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                disabled={isLoading}
              >
                <FaDownload className="mr-2" /> Export to Excel
              </button>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('lotCode')}>
                      Lot Code {sortConfig.key === 'lotCode' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('productId.name')}>
                      Product Name {sortConfig.key === 'productId.name' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('warehouse')}>
                      Warehouse {sortConfig.key === 'warehouse' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('productId.productCode')}>
                      Product Code {sortConfig.key === 'productId.productCode' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('expDate')}>
                      Expiration Date {sortConfig.key === 'expDate' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedData.map(lot => (
                    <tr key={lot._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lot.lotCode}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.productId?.name || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.warehouse}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.productId?.productCode || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lot.expDate ? format(new Date(lot.expDate), 'dd-MM-yyyy') : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} results
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-md ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 bg-gray-100 rounded-md text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-md ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </TabsContent>
        <TabsContent value="damaged">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              <button
                onClick={() => handleExport('damaged')}
                className="mb-4 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                disabled={isLoading}
              >
                <FaDownload className="mr-2" /> Export to Excel
              </button>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('lotCode')}>
                      Lot Code {sortConfig.key === 'lotCode' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('productId.name')}>
                      Product Name {sortConfig.key === 'productId.name' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('warehouse')}>
                      Warehouse {sortConfig.key === 'warehouse' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('productId.productCode')}>
                      Product Code {sortConfig.key === 'productId.productCode' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('damaged')}>
                      Damaged {sortConfig.key === 'damaged' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedData.map(lot => (
                    <tr key={lot._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lot.lotCode}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.productId?.name || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.warehouse}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.productId?.productCode || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot.damaged || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} results
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-md ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 bg-gray-100 rounded-md text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-md ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
      <ToastContainer />
    </div>
  );
};

export default StockReports;