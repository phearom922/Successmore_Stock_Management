import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import StockTable from '../components/StockTable';
import { FaSearch, FaTimes, FaDownload } from 'react-icons/fa';

const StockReports = () => {
  // Sorting for summary tab
  const [summarySort, setSummarySort] = useState({ key: null, direction: 'ascending' });
  const [data, setData] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const token = localStorage.getItem('token');
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [currentTab, setCurrentTab] = useState('all-stock');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // ดึงข้อมูล user จาก token
  const userData = token ? JSON.parse(atob(token.split('.')[1])) : {};
  const isAdmin = userData.role === 'admin';
  const userWarehouseId = userData.warehouse ? userData.warehouse.toString() : '';
  console.log('User data from token:', { userWarehouseId, isAdmin, rawWarehouse: userData.warehouse });

  useEffect(() => {
    fetchWarehouses();
    if (!isAdmin && userWarehouseId) {
      setSelectedWarehouse(userWarehouseId); // ใช้ _id สำหรับ User Role
    }
    fetchData('all-stock', null, isAdmin ? 'all' : userWarehouseId); // ใช้ _id
  }, [userWarehouseId]);

  const fetchWarehouses = async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/warehouses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWarehouses(data);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      toast.error('Failed to load warehouses');
      setWarehouses([]); // ตั้งค่าเป็น array ว่างถ้า error
    }
  };

  const fetchData = async (type = null, customSearch = null, customWarehouse = null) => {
    setIsLoading(true);
    try {
      const tabType = type || currentTab || 'all-stock';
      const search = customSearch !== null ? customSearch : searchQuery;
      const warehouseVal = customWarehouse !== null ? customWarehouse : selectedWarehouse;
      const effectiveWarehouse = !isAdmin && warehouseVal === 'all' ? userWarehouseId : warehouseVal; // ใช้ _id
      console.log('Fetching data with warehouse:', effectiveWarehouse); // Debug
      // Send only 'search' param, let backend handle matching Lot Code or Product Code
      const { data } = await axios.get(`${API_BASE_URL}/api/stock-reports`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { type: tabType, warehouse: effectiveWarehouse, search }
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
      console.error('Error fetching stock reports:', error.response || error);
      const errorMessage = error.response?.data?.message || 'Unknown error';
      toast.error(`Failed to load ${currentTab.replace('-', ' ')} reports: ${errorMessage}`);
      setData([]); // ตั้งค่าเป็น array ว่างถ้า error
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
      if (type === 'summary') {
        // Export summaryRows as Excel
        const xlsx = await import('xlsx');
        const worksheet = xlsx.utils.json_to_sheet(summaryRows);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Summary');
        const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `summary-report-${new Date().toISOString().split('T')[0]}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/stock-reports/export`, {
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
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

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

  // Summary data: group by warehouse + productCode
  let summaryRows = [];
  if (data && data.length > 0) {
    const summaryMap = {};
    data.forEach(lot => {
      const warehouse = lot.warehouse || 'N/A';
      const productCode = lot.productId?.productCode || lot.productCode || 'N/A';
      const productName = lot.productId?.name || lot.productName || 'N/A';
      if (!summaryMap[warehouse]) summaryMap[warehouse] = {};
      if (!summaryMap[warehouse][productCode]) {
        summaryMap[warehouse][productCode] = {
          productName,
          damaged: 0,
          qtyOnHand: 0,
          total: 0
        };
      }
      summaryMap[warehouse][productCode].damaged += lot.damaged || 0;
      summaryMap[warehouse][productCode].qtyOnHand += lot.qtyOnHand || 0;
      summaryMap[warehouse][productCode].total += (lot.qtyOnHand || 0) + (lot.damaged || 0);
    });
    Object.entries(summaryMap).forEach(([warehouse, products]) => {
      Object.entries(products).forEach(([productCode, info]) => {
        summaryRows.push({
          warehouse,
          productCode,
          productName: info.productName,
          damaged: info.damaged,
          qtyOnHand: info.qtyOnHand,
          total: info.total
        });
      });
    });
    // Sort summaryRows if needed
    if (summarySort.key) {
      summaryRows.sort((a, b) => {
        const aValue = a[summarySort.key];
        const bValue = b[summarySort.key];
        if (aValue < bValue) return summarySort.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return summarySort.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
  }

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="p-6 max-w-screen mx-auto">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Stock Reports</h1>
              <p className="text-gray-600">Stock data and analysis</p>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() => handleExport(currentTab)}
                variant="success"
                className="gap-2 px-4 py-2 bg-green-600 text-white rounded cursor-pointer hover:bg-green-700 transition-colors"
                disabled={isLoading}
              >
                <FaDownload /> Export
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              {isAdmin ? (
                <Select onValueChange={handleWarehouseChange} value={selectedWarehouse}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Warehouses</SelectItem>
                    {warehouses.map(w => (
                      <SelectItem key={w._id} value={w._id.toString()}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="py-2 px-3 rounded bg-gray-100 text-gray-500 font-medium">
                  {warehouses.find(w => w._id.toString() === userWarehouseId)?.name || 'No warehouse assigned'}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Lot Code or Product Code..."
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              />
              <Button variant="outline" onClick={handleSearch}>
                <FaSearch />
              </Button>
              <Button variant="outline" onClick={handleClear}>
                <FaTimes />
              </Button>
            </div>
          </div>

          <Tabs
            defaultValue="all-stock"
            onValueChange={val => {
              setCurrentTab(val);
              setCurrentPage(1);
              fetchData(val, searchQuery);
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all-stock">All Stock</TabsTrigger>
              <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
              <TabsTrigger value="expiring-soon">Expiring Soon</TabsTrigger>
              <TabsTrigger value="damaged">Damaged</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            {/* All Stock Tab */}
            <TabsContent value="all-stock">
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <StockTable
                  data={paginatedData}
                  sortConfig={sortConfig}
                  requestSort={requestSort}
                  handlePageChange={handlePageChange}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  isAllStock
                />
              )}
            </TabsContent>

            {/* Low Stock Tab */}
            <TabsContent value="low-stock">
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <StockTable
                  data={paginatedData}
                  sortConfig={sortConfig}
                  requestSort={requestSort}
                  handlePageChange={handlePageChange}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  isLowStock
                />
              )}
            </TabsContent>

            {/* Expiring Soon Tab */}
            <TabsContent value="expiring-soon">
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <StockTable
                  data={paginatedData}
                  sortConfig={sortConfig}
                  requestSort={requestSort}
                  handlePageChange={handlePageChange}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  isExpiringSoon
                />
              )}
            </TabsContent>

            {/* Damaged Tab */}
            <TabsContent value="damaged">
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <StockTable
                  data={paginatedData}
                  sortConfig={sortConfig}
                  requestSort={requestSort}
                  handlePageChange={handlePageChange}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  isDamaged
                />
              )}
            </TabsContent>

            {/* Summary Tab */}
            <TabsContent value="summary">
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="min-w-full divide-y divide-gray-200 ">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider cursor-pointer" onClick={() => {
                          setSummarySort(s => ({ key: 'warehouse', direction: s.key === 'warehouse' && s.direction === 'ascending' ? 'descending' : 'ascending' }));
                        }}>Warehouse {summarySort.key === 'warehouse' ? (summarySort.direction === 'ascending' ? '▲' : '▼') : ''}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider cursor-pointer" onClick={() => {
                          setSummarySort(s => ({ key: 'productCode', direction: s.key === 'productCode' && s.direction === 'ascending' ? 'descending' : 'ascending' }));
                        }}>Product Code {summarySort.key === 'productCode' ? (summarySort.direction === 'ascending' ? '▲' : '▼') : ''}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider cursor-pointer" onClick={() => {
                          setSummarySort(s => ({ key: 'productName', direction: s.key === 'productName' && s.direction === 'ascending' ? 'descending' : 'ascending' }));
                        }}>Product Name {summarySort.key === 'productName' ? (summarySort.direction === 'ascending' ? '▲' : '▼') : ''}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider cursor-pointer" onClick={() => {
                          setSummarySort(s => ({ key: 'damaged', direction: s.key === 'damaged' && s.direction === 'ascending' ? 'descending' : 'ascending' }));
                        }}>Damaged {summarySort.key === 'damaged' ? (summarySort.direction === 'ascending' ? '▲' : '▼') : ''}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider cursor-pointer" onClick={() => {
                          setSummarySort(s => ({ key: 'qtyOnHand', direction: s.key === 'qtyOnHand' && s.direction === 'ascending' ? 'descending' : 'ascending' }));
                        }}>qtyOnHand {summarySort.key === 'qtyOnHand' ? (summarySort.direction === 'ascending' ? '▲' : '▼') : ''}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider cursor-pointer" onClick={() => {
                          setSummarySort(s => ({ key: 'total', direction: s.key === 'total' && s.direction === 'ascending' ? 'descending' : 'ascending' }));
                        }}>Total {summarySort.key === 'total' ? (summarySort.direction === 'ascending' ? '▲' : '▼') : ''}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {summaryRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-gray-400">No summary data found</td>
                        </tr>
                      ) : (
                        summaryRows.map((row, idx) => (
                          <tr key={row.warehouse + '-' + row.productCode + '-' + idx}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.warehouse}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.productCode}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.productName}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.damaged}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.qtyOnHand}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.total}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <ToastContainer />
    </div>
  );
};

export default StockReports;