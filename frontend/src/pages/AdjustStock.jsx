import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import * as XLSX from 'xlsx';
import { startOfDay, endOfDay, format } from 'date-fns';
import DatePicker from 'react-datepicker';


const AdjustStock = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lots, setLots] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedLot, setSelectedLot] = useState('');
  const [quantityAdjustment, setQuantityAdjustment] = useState('');
  const [reason, setReason] = useState('Manual Adjustment');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [adjustmentHistory, setAdjustmentHistory] = useState([]);
  const [excelFile, setExcelFile] = useState(null);
  const [importedData, setImportedData] = useState([]);
  const [activeTab, setActiveTab] = useState('adjust');
  const [filters, setFilters] = useState({
    startDate: startOfDay(new Date()),
    endDate: endOfDay(new Date()),
    warehouse: 'all',
    search: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const productInputRef = React.useRef(null);

  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const user = token ? JSON.parse(atob(token.split('.')[1])) : {};
  const userWarehouseId = user.warehouse?.toString();

  const API_BASE_URL = 'http://localhost:3000';

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchInitialData();
    fetchAdjustmentHistory();
  }, [token, navigate, filters]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [warehousesRes, productsRes, categoriesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/warehouses`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/api/products`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/api/categories`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setWarehouses(warehousesRes.data);
      setProducts(productsRes.data.map(p => ({ ...p, _id: p._id.toString() })));
      setCategories(categoriesRes.data);

      const defaultWarehouse = user.role === 'admin' ? '' : userWarehouseId;
      if (defaultWarehouse) setSelectedWarehouse(defaultWarehouse);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load data');
      console.error('Fetch initial data error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLots = async (warehouseId, productId) => {
    if (!warehouseId || !productId) {
      setLots([]);
      return;
    }
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/lots`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { productId, warehouse: warehouseId }
      });
      const filteredLots = data.filter(lot => lot.warehouse.toString() === warehouseId && lot.qtyOnHand > 0);
      setLots(filteredLots);
      if (filteredLots.length > 0) setSelectedLot(filteredLots[0]._id.toString());
    } catch (error) {
      toast.error('Failed to load lots');
      console.error('Fetch lots error:', error);
    }
  };

  const fetchAdjustmentHistory = async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/adjust-stock/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Remove filtering by today, let UI filter by date range
      const sortedHistory = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setAdjustmentHistory(sortedHistory);
    } catch (error) {
      toast.error('Failed to load adjustment history');
      console.error('Fetch adjustment history error:', error.response?.data);
    }
  };

  const handleAdjustStock = async () => {
    if (!selectedLot || !quantityAdjustment || !reason) {
      toast.error('Please fill all required fields');
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmAdjustStock = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);
    try {
      const payload = {
        lotId: selectedLot,
        quantityAdjustment: Number(quantityAdjustment),
        reason,
        warehouseId: selectedWarehouse,
      };
      const response = await axios.post(`${API_BASE_URL}/api/adjust-stock`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(response.data.message);
      setQuantityAdjustment('');
      setReason('Manual Adjustment');
      fetchAdjustmentHistory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to adjust stock');
      console.error('Adjust stock error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'application/vnd.ms-excel' || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
      setExcelFile(file);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        const mappedData = await Promise.all(worksheet.map(async row => {
          const { data: lot } = await axios.get(`${API_BASE_URL}/api/lots/lot-code/${row['Lot Code']}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          return {
            lotId: lot._id.toString(),
            countedQuantity: Number(row['Counted Quantity']),
            reason: row['Reason'] || 'Stock Count',
            warehouseId: row['Warehouse'] ? warehouses.find(w => w.name === row['Warehouse'])?._id.toString() : selectedWarehouse,
          };
        }));
        setImportedData(mappedData);
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error('Please upload a valid Excel file (.xls or .xlsx)');
    }
  };

  const saveStockCount = async () => {
    if (importedData.length === 0) {
      toast.error('No data to save');
      return;
    }
    setIsLoading(true);
    try {
      const payload = importedData.map(item => ({
        lotId: item.lotId,
        countedQuantity: item.countedQuantity,
        reason: item.reason,
        warehouseId: item.warehouseId,
      }));
      const response = await axios.post(`${API_BASE_URL}/api/stock-count/import`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(response.data.message);
      setExcelFile(null);
      setImportedData([]);
      fetchAdjustmentHistory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to import stock count');
      console.error('Import stock count error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getReasonColor = (reason) => {
    switch (reason) {
      case 'Manual Adjustment': return 'bg-gray-200 text-gray-800';
      case 'Damage': return 'bg-red-200 text-red-800';
      case 'Received': return 'bg-green-200 text-green-800';
      case 'Lost': return 'bg-yellow-200 text-yellow-800';
      case 'Stock Count': return 'bg-blue-200 text-blue-800';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredHistory = adjustmentHistory.filter(record => {
    const search = filters.search.toLowerCase();
    const warehouseMatch = filters.warehouse === 'all' || record.warehouseId?.toString() === filters.warehouse;
    const dateMatch = new Date(record.timestamp) >= filters.startDate && new Date(record.timestamp) <= filters.endDate;
    const productMatch = record.productCode?.toLowerCase().includes(search) ||
                        record.productName?.toLowerCase().includes(search) ||
                        record.userId?.toLowerCase().includes(search);
    return warehouseMatch && dateMatch && productMatch;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredHistory.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  const handleProductSearch = (e) => {
    const value = e.target.value;
    setProductSearch(value);
    let results = [];
    if (value.trim() === '') {
      results = products;
    } else {
      const search = value.toLowerCase();
      results = products.filter(product =>
        product.productCode?.toLowerCase().includes(search) ||
        product.name?.toLowerCase().includes(search)
      );
    }
    setSearchResults(results);
  };

  const handleProductSelect = (productId) => {
    const selected = products.find(p => p._id === productId);
    setSelectedProduct(productId);
    setProductSearch(selected ? `${selected.name} (${selected.productCode})` : '');
    fetchLots(selectedWarehouse, productId);
  };

  return (
    <div className="p-4 md:p-6 mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Adjust Stock Management</h1>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="adjust">Adjust Stock</TabsTrigger>
              <TabsTrigger value="count">Stock Counting</TabsTrigger>
            </TabsList>
            <TabsContent value="adjust">
              <Card>
                <CardHeader>
                  <CardTitle>Adjust Stock</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Improved Layout: Group selection and adjustment sections */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Selection Section */}
                    <div className="col-span-1 md:col-span-2 bg-white rounded-lg shadow-sm p-4 border mb-2">
                      <h2 className="text-lg font-semibold mb-4 text-blue-700">เลือกข้อมูลสินค้า</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="warehouse">Warehouse</Label>
                          <Select
                            value={selectedWarehouse || ''}
                            onValueChange={val => {
                              setSelectedWarehouse(val);
                              setSelectedProduct('');
                              setSelectedLot('');
                              fetchLots(val, selectedProduct);
                            }}
                            disabled={isLoading}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select warehouse" />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouses.map(w => (
                                <SelectItem key={w._id} value={w._id.toString()}>
                                  {w.name} ({w.warehouseCode})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="category" className="mb-2">Category</Label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <button
                              type="button"
                              className={`px-3 py-1 rounded-lg border text-sm font-medium ${selectedCategory === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'} hover:bg-blue-100`}
                              onClick={() => {
                                setSelectedCategory('All');
                                setSearchResults(products);
                              }}
                            >
                              All Products
                            </button>
                            {categories.map(category => (
                              <button
                                key={category._id}
                                type="button"
                                className={`px-3 py-1 rounded-lg border text-sm font-medium ${selectedCategory === category._id.toString() ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'} hover:bg-blue-100`}
                                onClick={() => {
                                  setSelectedCategory(category._id.toString());
                                  setSearchResults(products.filter(p => p.category && p.category._id.toString() === category._id.toString()));
                                }}
                              >
                                {category.name}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <Label htmlFor="product">Product</Label>
                          <div className="relative">
                            <Input
                              ref={productInputRef}
                              type="text"
                              placeholder="Search product by name or code..."
                              value={productSearch}
                              onChange={handleProductSearch}
                              onFocus={() => {
                                if (selectedCategory === 'All') {
                                  setSearchResults(products);
                                } else {
                                  setSearchResults(products.filter(p => p.category && p.category._id.toString() === selectedCategory));
                                }
                              }}
                              onBlur={() => setTimeout(() => setSearchResults([]), 150)}
                              disabled={!selectedWarehouse || isLoading}
                            />
                            {searchResults.length > 0 && (
                              <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {searchResults.map(product => (
                                  <li
                                    key={product._id}
                                    className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-100"
                                    onMouseDown={() => handleProductSelect(product._id)}
                                  >
                                    {product.name} ({product.productCode})
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="lot">Lot</Label>
                          <Select
                            value={selectedLot || ''}
                            onValueChange={setSelectedLot}
                            disabled={!selectedProduct || isLoading}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select lot" />
                            </SelectTrigger>
                            <SelectContent>
                              {lots.map(lot => (
                                <SelectItem key={lot._id} value={lot._id.toString()}>
                                  {lot.lotCode} (Qty: {lot.qtyOnHand})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    {/* Adjustment Section */}
                    <div className="col-span-1 bg-gray-50 rounded-lg shadow-sm p-4 border flex flex-col justify-center">
                      <h2 className="text-lg font-semibold mb-4 text-green-700">ปรับจำนวนสินค้า</h2>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="quantity">Quantity Adjustment</Label>
                          <Input
                            type="number"
                            id="quantity"
                            value={quantityAdjustment}
                            onChange={e => setQuantityAdjustment(e.target.value)}
                            placeholder="Enter adjustment (positive or negative)"
                            min="-9999"
                            max="9999"
                          />
                        </div>
                        <div>
                          <Label htmlFor="reason">Reason</Label>
                          <Select
                            value={reason}
                            onValueChange={setReason}
                            disabled={isLoading}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Manual Adjustment">Manual Adjustment</SelectItem>
                              <SelectItem value="Damage">Damage</SelectItem>
                              <SelectItem value="Received">Received</SelectItem>
                              <SelectItem value="Lost">Lost</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={handleAdjustStock}
                          disabled={!selectedLot || !quantityAdjustment || isLoading}
                          className="w-full mt-6"
                        >
                          Adjust Stock
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
                
              </Card>
            </TabsContent>
            <TabsContent value="count">
              <Card>
                <CardHeader>
                  <CardTitle>Stock Counting</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="excelFile">Import Excel File</Label>
                      <Input
                        type="file"
                        id="excelFile"
                        accept=".xls,.xlsx"
                        onChange={handleFileUpload}
                        disabled={isLoading}
                      />
                    </div>
                    {importedData.length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium mb-2">Imported Data</h3>
                        <ScrollArea className="h-[300px] rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Lot Code</TableHead>
                                <TableHead>Counted Quantity</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>Warehouse</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {importedData.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell>{item.lotCode}</TableCell>
                                  <TableCell>{item.countedQuantity}</TableCell>
                                  <TableCell>{item.reason}</TableCell>
                                  <TableCell>{warehouses.find(w => w._id.toString() === item.warehouseId)?.name || 'N/A'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button
                    onClick={saveStockCount}
                    disabled={importedData.length === 0 || isLoading}
                    className="w-full md:w-auto"
                  >
                    Save Stock Count
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Adjustment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label>Start Date</Label>
                  <DatePicker
                    selected={filters.startDate}
                    onChange={(date) => setFilters(prev => ({ ...prev, startDate: startOfDay(date) }))}
                    selectsStart
                    startDate={filters.startDate}
                    endDate={filters.endDate}
                    dateFormat="dd/MM/yyyy"
                    className="w-full p-2 border rounded-md"
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <DatePicker
                    selected={filters.endDate}
                    onChange={(date) => setFilters(prev => ({ ...prev, endDate: endOfDay(date) }))}
                    selectsEnd
                    startDate={filters.startDate}
                    endDate={filters.endDate}
                    minDate={filters.startDate}
                    dateFormat="dd/MM/yyyy"
                    className="w-full p-2 border rounded-md"
                  />
                </div>
                <div>
                  <Label>Warehouse</Label>
                  <Select
                    value={filters.warehouse}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, warehouse: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Warehouses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Warehouses</SelectItem>
                      {warehouses.map(w => (
                        <SelectItem key={w._id} value={w._id.toString()}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Search</Label>
                  <Input
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    placeholder="Search by Product Code, Name, or User..."
                    className="w-full"
                  />
                </div>
              </div>
              <ScrollArea className="h-[400px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot Code</TableHead>
                      <TableHead>Product Code</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Before Qty</TableHead>
                      <TableHead>After Qty</TableHead>
                      <TableHead>Adjustment</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentItems.map((record) => (
                      <TableRow key={record._id}>
                        <TableCell>{record.lotCode}</TableCell>
                        <TableCell>{record.productCode}</TableCell>
                        <TableCell>{record.productName}</TableCell>
                        <TableCell>{record.beforeQty}</TableCell>
                        <TableCell>{record.afterQty}</TableCell>
                        <TableCell>{record.quantityAdjusted}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getReasonColor(record.reason)}`}>
                            {record.reason}
                          </span>
                        </TableCell>
                        <TableCell>{format(new Date(record.timestamp), 'dd-MM-yyyy, HH:mm')}</TableCell>
                        <TableCell>{record.userId || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="mt-4 flex justify-between items-center">
                <span>
                  Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredHistory.length)} of {filteredHistory.length} results
                </span>
                <div className="space-x-2">
                  <Button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Confirm Adjust Stock</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Lot</Label>
                  <p className="font-medium">{lots.find(l => l._id.toString() === selectedLot)?.lotCode || 'N/A'}</p>
                </div>
                <div className="space-y-2">
                  <Label>Current Quantity</Label>
                  <p className="font-medium">{lots.find(l => l._id.toString() === selectedLot)?.qtyOnHand || 'N/A'}</p>
                </div>
                <div className="space-y-2">
                  <Label>New Quantity</Label>
                  <p className="font-medium">{(lots.find(l => l._id.toString() === selectedLot)?.qtyOnHand || 0) + Number(quantityAdjustment)}</p>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <p className="font-medium">{reason}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowConfirmModal(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button onClick={confirmAdjustStock} disabled={isLoading}>
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
        </div>
      )}
    </div>
  );
};

export default AdjustStock;