import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FaSearch, FaChevronLeft, FaChevronRight, FaCalendarAlt } from 'react-icons/fa';
import { FiDownload } from 'react-icons/fi';

const ReceiveHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [warehouse, setWarehouse] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin] = useState(localStorage.getItem('token') ?
    JSON.parse(atob(localStorage.getItem('token').split('.')[1])).role === 'admin' : false);

  useEffect(() => {
    fetchWarehouses();
    fetchTransactions();
  }, [page, startDate, endDate, warehouse]);

  const fetchWarehouses = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('http://localhost:3000/api/warehouses', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWarehouses(data);
      if (!isAdmin && data.length > 0) {
        setWarehouse(data[0].name);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('http://localhost:3000/api/receive-history', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          startDate: startDate ? format(startDate, 'dd-MM-yyyy') : '',
          endDate: endDate ? format(endDate, 'dd-MM-yyyy') : '',
          warehouse,
          searchQuery,
          page,
          limit
        }
      });
      setTransactions(data.data);
      setTotal(data.total);
    } catch (error) {
      console.error('Error fetching transactions:', error);
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
      const response = await axios.get('http://localhost:3000/api/receive-history/export', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          startDate: startDate ? format(startDate, 'dd-MM-yyyy') : '',
          endDate: endDate ? format(endDate, 'dd-MM-yyyy') : '',
          warehouse,
          searchQuery
        },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receive-history-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data. Please try again or check the server logs.');
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1); // Reset to first page when searching
    fetchTransactions();
  };

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setWarehouse('');
    setSearchQuery('');
    setPage(1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Receive History</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage all product receiving transactions</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <button
            onClick={handleExport}
            className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            disabled={isLoading}
          >
            <FiDownload className="mr-2" />
            Export to Excel
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <div className="relative">
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date)}
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  maxDate={endDate || new Date()}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholderText="Select start date"
                  disabled={isLoading}
                />
                <FaCalendarAlt className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <div className="relative">
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  minDate={startDate}
                  maxDate={new Date()}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholderText="Select end date"
                  disabled={isLoading}
                />
                <FaCalendarAlt className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>

            {isAdmin ? (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
                <select
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                >
                  <option value="">All Warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w._id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                  {warehouse || 'Not assigned'}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search transactions..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                />
                <FaSearch className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>

            <div className="flex items-end space-x-2">
              <button
                type="submit"
                className="flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                disabled={isLoading}
              >
                <FaSearch className="mr-2" />
                Search
              </button>
              {(startDate || endDate || warehouse || searchQuery) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex items-center justify-center px-3 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  disabled={isLoading}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Results Section */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Transaction #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Date/Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Lot Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Warehouse</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Production Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Expiration Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.length > 0 ? (
                  transactions.map((trans) => (
                    <tr key={trans._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {trans.transactionNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(trans.timestamp), 'dd-MM-yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trans.userId?.username || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trans.supplierId?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trans.productId?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trans.lotId?.lotCode || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trans.quantity} {/* แสดง quantity ของแต่ละการรับ */}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trans.warehouse || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${trans.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : trans.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                          }`}>
                          {trans.status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trans.lotId?.productionDate ? format(new Date(trans.lotId.productionDate), 'dd-MM-yyyy') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trans.lotId?.expDate ? format(new Date(trans.lotId.expDate), 'dd-MM-yyyy') : 'N/A'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="11" className="px-6 py-8 text-center">
                      <div className="text-gray-500">No transactions found</div>
                      {(startDate || endDate || warehouse || searchQuery) && (
                        <button
                          onClick={clearFilters}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {transactions.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-500">
                Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, total)}</span> of <span className="font-medium">{total}</span> results
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className={`p-2 rounded-md ${page === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
                  aria-label="Previous page"
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
                  aria-label="Next page"
                >
                  <FaChevronRight />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReceiveHistory;