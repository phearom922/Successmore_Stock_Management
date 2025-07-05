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
import { FaSearch, FaTimes, FaDownload} from 'react-icons/fa';







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
   <div className="p-6 max-w-screen mx-auto">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-bold">Stock Reports</CardTitle>
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
              <Select onValueChange={handleWarehouseChange} value={selectedWarehouse}>
                <SelectTrigger className="w-full">
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
            
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all-stock">All Stock</TabsTrigger>
              <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
              <TabsTrigger value="expiring-soon">Expiring Soon</TabsTrigger>
              <TabsTrigger value="damaged">Damaged</TabsTrigger>
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
          </Tabs>
        </CardContent>
      </Card>
      <ToastContainer />
    </div>
  );
};
export default StockReports;