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
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
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
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { startOfDay, endOfDay, format } from 'date-fns';
import jsPDF from 'jspdf';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

const TransferOrder = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sourceWarehouse, setSourceWarehouse] = useState('');
  const [destinationWarehouse, setDestinationWarehouse] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [lots, setLots] = useState([]);
  const [currentItem, setCurrentItem] = useState({
    lotId: '',
    quantity: ''
  });
  const [addedItems, setAddedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isManualSelection, setIsManualSelection] = useState(false);
  const [transferHistory, setTransferHistory] = useState([]);
  const [filters, setFilters] = useState({
    status: 'Pending',
    warehouse: 'all',
    type: 'all',
    startDate: startOfDay(new Date()),
    endDate: endOfDay(new Date())
  });
  const [activeTab, setActiveTab] = useState('newTransfer');
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productInputRef = React.useRef(null);

  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const user = token ? JSON.parse(atob(token.split('.')[1])) : {};
  const userWarehouseId = user.warehouse?.toString() || (user.role === 'admin' ? filters.warehouse : null);

  const API_BASE_URL = 'http://localhost:3000';

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchData();
    fetchTransferHistory();
  }, [token, navigate, filters]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching initial data...');
      const [warehousesRes, productsRes, categoriesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/warehouses`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/api/products`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/api/categories`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      console.log('Warehouses:', warehousesRes.data);
      console.log('Products:', productsRes.data);
      console.log('Categories:', categoriesRes.data);
      setWarehouses(warehousesRes.data);
      setProducts(productsRes.data.map(p => ({ ...p, _id: p._id.toString() })));
      setCategories(categoriesRes.data);

      const defaultWarehouse = user.role !== 'admin' ? user.warehouse?.toString() : warehousesRes.data[0]?._id?.toString();
      console.log('Default Warehouse:', defaultWarehouse);
      if (!defaultWarehouse) {
        toast.error('No warehouse assigned or available');
        return;
      }
      setSourceWarehouse(defaultWarehouse);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load data');
      console.error('Fetch data error:', error);
      if (error.response?.status === 401) navigate('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLots = async (productId) => {
    if (!productId || !sourceWarehouse) return;
    try {
      console.log('Fetching lots for product:', productId, 'warehouse:', sourceWarehouse);
      const { data } = await axios.get(`${API_BASE_URL}/api/lots`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { productId, warehouse: sourceWarehouse }
      });
      console.log('Fetched lots:', data);
      const filteredLots = data.filter(lot => lot.warehouse.toString() === sourceWarehouse && lot.qtyOnHand > 0);
      const sortedLots = filteredLots.sort((a, b) => new Date(a.expDate) - new Date(b.expDate));
      setLots(sortedLots);
      if (!isManualSelection && sortedLots.length > 0) {
        setCurrentItem(prev => ({ ...prev, lotId: sortedLots[0]._id.toString() }));
      }
    } catch (error) {
      toast.error('Failed to load lots');
      console.error('Fetch lots error:', error);
    }
  };

  const fetchTransferHistory = async () => {
    try {
      console.log('Fetching transfer history with filters:', filters);
      const params = {
        status: filters.status !== 'all' ? filters.status : undefined,
        warehouse: filters.warehouse !== 'all' ? filters.warehouse : undefined,
        startDate: filters.startDate.toISOString(),
        endDate: filters.endDate.toISOString()
      };
      const { data } = await axios.get(`${API_BASE_URL}/api/transfer-history`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      console.log('Transfer history data:', data);
      setTransferHistory(data);
    } catch (error) {
      toast.error('Failed to load transfer history');
      console.error('Fetch transfer history error:', error.response?.data);
    }
  };

  const addItem = () => {
    const quantity = Number(currentItem.quantity);
    if (!quantity) {
      toast.error('Please fill all required fields');
      return;
    }

    let remainingQuantity = quantity;
    const selectedLots = [];
    let currentLots = [...lots];

    while (remainingQuantity > 0 && currentLots.length > 0) {
      const lot = currentLots[0];
      if (!lot) {
        toast.error('No available lots for the selected quantity');
        return;
      }

      const qtyToTake = Math.min(remainingQuantity, lot.qtyOnHand);
      if (qtyToTake <= 0) {
        toast.error('Quantity exceeds available stock');
        return;
      }

      const productId = lot.productId._id ? lot.productId._id.toString() : lot.productId.toString();
      const product = products.find(p => p._id === productId);

      selectedLots.push({
        lotId: lot._id.toString(),
        quantity: qtyToTake,
        productName: product?.name || 'Unknown',
        productCode: product?.productCode || 'N/A',
        lotCode: lot.lotCode,
        prodDate: lot.productionDate,
        expDate: lot.expDate
      });

      remainingQuantity -= qtyToTake;
      currentLots = currentLots.filter(l => l._id.toString() !== lot._id.toString());
    }

    if (remainingQuantity > 0) {
      toast.error('Insufficient stock across all lots');
      return;
    }

    setAddedItems(prevItems => [...prevItems, ...selectedLots]);
    setSelectedProduct('');
    setCurrentItem({ lotId: '', quantity: '' });
    fetchLots(''); // รีเซ็ต lots
  };

  const removeItem = (index) => {
    setAddedItems(addedItems.filter((_, i) => i !== index));
  };

  const handleTransfer = async () => {
    if (addedItems.length === 0 || !destinationWarehouse || sourceWarehouse === destinationWarehouse) {
      toast.error('Please add items and select a different destination warehouse');
      return;
    }
    const totalItems = addedItems.length;
    const totalQuantity = addedItems.reduce((sum, item) => sum + Number(item.quantity), 0);
    setShowConfirmModal(true);
  };

  const confirmTransfer = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);
    try {
      const payload = {
        lots: addedItems.map(item => ({ lotId: item.lotId, quantity: Number(item.quantity) })),
        sourceWarehouseId: sourceWarehouse,
        destinationWarehouseId: destinationWarehouse,
        note: ''
      };
      console.log('Transferring with payload:', JSON.stringify(payload, null, 2));
      const response = await axios.post(`${API_BASE_URL}/api/transfer`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message);
      console.log('Transfer Number:', response.data.transferNumber);
      setAddedItems([]);
      fetchTransferHistory(); // อัปเดตประวัติหลังโอน
    } catch (error) {
      console.error('Transfer error:', error.response?.data || error);
      toast.error(error.response?.data?.message || 'Failed to transfer stock');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelTransfer = () => {
    setShowConfirmModal(false);
  };

  const handleConfirmTransfer = async (transferId) => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/api/transfer/${transferId}/confirm`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message);
      fetchTransferHistory();
    } catch (error) {
      toast.error('Failed to confirm transfer');
      console.error('Confirm error:', error.response?.data);
    }
  };

  const handleRejectTransfer = async (transferId) => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/api/transfer/${transferId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message);
      fetchTransferHistory();
    } catch (error) {
      toast.error('Failed to reject transfer');
      console.error('Reject error:', error.response?.data);
    }
  };

  const generatePDF = (transfer) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // -------------------- HEADER --------------------
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TRANSFER ORDER REQUEST', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Transfer Document', 105, 27, { align: 'center' });

    // Add divider line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.4);
    doc.line(15, 32, 195, 32);

    // -------------------- TRANSACTION INFO --------------------
    doc.setFontSize(10);
    let y = 40;

    // Transaction Number
    doc.setFont('helvetica', 'bold');
    doc.text('Transaction #:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(transfer.transferNumber || 'N/A', 45, y);

    // Issue Type
    doc.setFont('helvetica', 'bold');
    doc.text('Issue Type:', 110, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Transfer', 140, y);

    y += 7;

    // Source Warehouse
    doc.setFont('helvetica', 'bold');
    doc.text('From WH:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(transfer.sourceWarehouseId?.name || 'N/A', 45, y);

    // Destination Warehouse
    doc.setFont('helvetica', 'bold');
    doc.text('To WH:', 110, y);
    doc.setFont('helvetica', 'normal');
    doc.text(transfer.destinationWarehouseId?.name || 'N/A', 140, y);

    y += 7;

    // Date
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(transfer.createdAt), 'dd/MM/yyyy, HH:mm:ss'), 45, y);

    // Transfer By
    doc.setFont('helvetica', 'bold');
    doc.text('TRF By:', 110, y);
    doc.setFont('helvetica', 'normal');
    doc.text(transfer.userId?.username || 'Unknown', 140, y);

    // Add divider line
    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.line(15, y, 195, y);
    y += 10;

    // -------------------- ITEMS LIST --------------------
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ITEMS LIST', 20, y);
    y += 2;

    // -------- Table Header --------
    doc.setFontSize(8);
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y + 5, 180, 8, 'F');  // header background
    doc.setDrawColor(220, 220, 220);
    doc.rect(15, y + 5, 180, 8);

    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.text('No.', 17, y + 10);
    doc.text('Product Code', 25, y + 10);
    doc.text('Product Name', 50, y + 10);
    doc.text('Lot Code', 100, y + 10);
    doc.text('Qty', 125, y + 10);
    doc.text('Production Date', 140, y + 10);
    doc.text('Exp Date', 170, y + 10);

    y += 15;

    // -------- Table Rows --------
    doc.setFont('helvetica', 'normal');
    transfer.lots.forEach((lot, index) => {
      if (y > 270) {
        doc.addPage();
        y = 22;

        doc.setFillColor(240, 240, 240);
        doc.rect(15, y, 180, 8, 'F');
        doc.rect(15, y, 180, 8);
        doc.setFont('helvetica', 'bold');
        doc.text('No.', 17, y + 5);
        doc.text('Product Code', 27, y + 5);
        doc.text('Product Name', 60, y + 5);
        doc.text('Lot Code', 100, y + 5);
        doc.text('Qty', 125, y + 5);
        doc.text('Production Date', 140, y + 5);
        doc.text('Exp Date', 170, y + 5);
        y += 10;
      }

      const product = lot.lotId?.productId || {};

      if (index % 2 === 0) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(250, 250, 250);
      }
      doc.rect(15, y - 2, 180, 7, 'F');
      doc.rect(15, y - 2, 180, 7);

      doc.setFont('helvetica', 'normal');
      doc.text(String(index + 1) + '.', 17, y + 3);
      doc.text(product.productCode || 'N/A', 25, y + 3);
      doc.text(product.name || 'N/A', 50, y + 3);
      doc.text(lot.lotId?.lotCode || 'N/A', 100, y + 3);
      doc.text(String(lot.quantity), 125, y + 3);
      doc.text(lot.lotId?.productionDate ? format(new Date(lot.lotId.productionDate), 'dd/MM/yyyy') : 'N/A', 140, y + 3);
      doc.text(lot.lotId?.expDate ? format(new Date(lot.lotId.expDate), 'dd/MM/yyyy') : 'N/A', 170, y + 3);

      y += 7;
    });

    // -------------------- FOOTER --------------------
    const footerY = 285;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated on: ' + format(new Date(), 'dd/MM/yyyy HH:mm:ss'), 20, footerY);
    doc.text('Page ' + doc.getCurrentPageInfo().pageNumber, 105, footerY, { align: 'center' });
    doc.text('© Successmore Cambodia', 190, footerY, { align: 'right' });

    // Open PDF in new tab
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  };

  const filteredProducts = selectedCategory === 'All'
    ? products
    : products.filter(p => p.category && p.category._id.toString() === selectedCategory);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return <Badge variant="secondary" className="bg-yellow-500 text-white">{status}</Badge>;
      case 'Confirmed':
        return <Badge variant="success" className="bg-green-600 text-white">{status}</Badge>;
      case 'Rejected':
        return <Badge variant="destructive">{status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleProductSearch = (e) => {
    const value = e.target.value;
    setProductSearch(value);
    let results = [];
    if (value.trim() === '') {
      results = filteredProducts;
    } else {
      const search = value.toLowerCase();
      results = filteredProducts.filter(product =>
        product.productCode?.toLowerCase().includes(search) ||
        product.name?.toLowerCase().includes(search)
      );
    }
    setSearchResults(results);
    setShowProductDropdown(true);
  };

  const handleProductSelect = (productId) => {
    setSelectedProduct(productId);
    const selected = filteredProducts.find(p => p._id === productId);
    setProductSearch(selected ? `${selected.name} (${selected.productCode})` : '');
    fetchLots(productId);
    setShowProductDropdown(false);
    if (productInputRef.current) productInputRef.current.blur();
  };

  const handleAddItem = () => {
    addItem();
    setProductSearch('');
    setSelectedProduct('');
  };

  return (
    <div className="p-4 md:p-6 mx-auto bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Transfer Order Management</h1>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="newTransfer">New Transfer</TabsTrigger>
            <TabsTrigger value="history">Transfer History</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading && !products.length ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'newTransfer' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Create New Transfer</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="sourceWarehouse" className="mb-2">Source Warehouse</Label>
                        <Select
                          value={sourceWarehouse || ''}
                          onValueChange={val => {
                            console.log('Selected source warehouse:', val);
                            setSourceWarehouse(val);
                          }}
                          disabled={user.role !== 'admin' || isLoading}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select source warehouse" />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouses.map(w => (
                              <SelectItem
                                key={w._id}
                                value={w._id.toString()}
                                disabled={user.role !== 'admin' && w._id.toString() !== user.warehouse?.toString()}
                              >
                                {w.name} ({w.warehouseCode})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className=' inline-flex flex-col mt-4'>
                        <Label htmlFor="category" className="mb-2">Category</Label>
                        <div className="flex flex-wrap gap-2 mb-4">
                          <button
                            type="button"
                            className={`px-3 py-1 rounded-lg border text-sm font-medium ${selectedCategory === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'} hover:bg-blue-100`}
                            onClick={() => setSelectedCategory('All')}
                          >
                            All Products
                          </button>
                          {categories.map(category => (
                            <button
                              key={category._id}
                              type="button"
                              className={`px-3 py-1 rounded-lg border text-sm font-medium ${selectedCategory === category._id.toString() ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'} hover:bg-blue-100`}
                              onClick={() => setSelectedCategory(category._id.toString())}
                            >
                              {category.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div >
                        <Label htmlFor="product" className="mb-2">Product</Label>
                        <div className="relative">
                          <Input
                            ref={productInputRef}
                            type="text"
                            placeholder="Search by product code or name..."
                            className="mb-2 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            value={productSearch}
                            onChange={handleProductSearch}
                            onFocus={() => {
                              setShowProductDropdown(true);
                              setSearchResults(filteredProducts);
                            }}
                            onBlur={() => setTimeout(() => setShowProductDropdown(false), 150)}
                            disabled={isLoading || !sourceWarehouse}
                            autoComplete="off"
                          />
                          {showProductDropdown && searchResults.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {searchResults.map(product => (
                                <li
                                  key={product._id}
                                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-100 ${selectedProduct === product._id ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
                                  onMouseDown={() => handleProductSelect(product._id)}
                                >
                                  {product.name} ({product.productCode})
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="destinationWarehouse" className="mb-2">Destination Warehouse</Label>
                        <Select
                          value={destinationWarehouse || ''}
                          onValueChange={val => {
                            console.log('Selected destination warehouse:', val);
                            setDestinationWarehouse(val);
                          }}
                          disabled={isLoading || !sourceWarehouse}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select destination warehouse" />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouses
                              .filter(w => w._id.toString() !== sourceWarehouse)
                              .map(w => (
                                <SelectItem
                                  key={w._id}
                                  value={w._id.toString()}
                                >
                                  {w.name} ({w.warehouseCode})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="manualSelection"
                          checked={isManualSelection}
                          onChange={(e) => {
                            setIsManualSelection(e.target.checked);
                            if (!e.target.checked && lots.length > 0) {
                              setCurrentItem(prev => ({ ...prev, lotId: lots[0]._id.toString() }));
                            } else {
                              setCurrentItem(prev => ({ ...prev, lotId: '' }));
                            }
                          }}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="manualSelection">Manual Lot Selection</Label>
                        {!isManualSelection && <Label>| Selected Lot (FEFO)</Label>}
                      </div>

                      {!isManualSelection && (
                        <Input
                          value={lots.length > 0 ? `${lots[0].lotCode} (Qty: ${lots[0].qtyOnHand}, Exp: ${new Date(lots[0].expDate).toLocaleDateString()})` : 'No lots available'}
                          readOnly
                        />
                      )}

                      {isManualSelection && (
                        <div>
                          <Label htmlFor="lot" className="mb-2">Lot</Label>
                          <Select
                            value={currentItem.lotId || ''}
                            onValueChange={val => {
                              console.log('Selected lot:', val);
                              setCurrentItem(prev => ({ ...prev, lotId: val }));
                            }}
                            disabled={isLoading || !selectedProduct}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select lot" />
                            </SelectTrigger>
                            <SelectContent>
                              {lots.map(lot => (
                                <SelectItem key={lot._id} value={lot._id.toString()}>
                                  {lot.lotCode} (Qty: {lot.qtyOnHand}, Exp: {new Date(lot.expDate).toLocaleDateString()})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div>
                        <Label htmlFor="quantity" className="mb-2">Quantity</Label>
                        <Input
                          type="number"
                          id="quantity"
                          value={currentItem.quantity}
                          onChange={e => setCurrentItem(prev => ({ ...prev, quantity: e.target.value }))}
                          placeholder="Enter quantity"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button
                    onClick={handleAddItem}
                    disabled={isLoading || !currentItem.quantity || (isManualSelection && !currentItem.lotId)}
                    className="w-full md:w-auto"
                  >
                    Add Item
                  </Button>
                </CardFooter>
              </Card>

              {addedItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      <span>Items to Transfer</span>
                      <Badge variant="outline">{addedItems.length} items</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px] rounded-md border">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead>Product Code</TableHead>
                            <TableHead>Product Name</TableHead>
                            <TableHead>Lot Code</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Prod Date</TableHead>
                            <TableHead>Exp Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {addedItems.map((item, index) => {
                            const lotInTable = addedItems.find(i => i.lotCode === item.lotCode);
                            const lot = lots.find(l => l._id.toString() === item.lotId) || lotInTable;
                            const productId = lot?.productId?._id?.toString() || lot?.productId?.toString();
                            const product = productId ? products.find(p => p._id === productId) : null;
                            return (
                              <TableRow key={index}>
                                <TableCell>{product?.productCode || lotInTable?.productCode || 'N/A'}</TableCell>
                                <TableCell>{product?.name || lotInTable?.productName || 'Unknown'}</TableCell>
                                <TableCell>{item.lotCode}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>{lot ? format(new Date(lot.prodDate || lot.productionDate), 'dd/MM/yyyy') : '-'}</TableCell>
                                <TableCell>{lot ? format(new Date(lot.expDate), 'dd/MM/yyyy') : '-'}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItem(index)}
                                    className="text-red-600 hover:text-red-900"
                                    disabled={isLoading}
                                  >
                                    Remove
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                  <CardFooter className="flex justify-end">
                    <Button
                      onClick={handleTransfer}
                      disabled={isLoading || addedItems.length === 0}
                      className="w-full md:w-auto"
                    >
                      {isLoading ? 'Processing...' : 'Transfer Stock'}
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <Card>
              <CardHeader>
                <CardTitle>Transfer History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={filters.status}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Confirmed">Confirmed</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <Label>Start Date</Label>
                    <DatePicker
                      selected={filters.startDate}
                      onChange={(date) => setFilters(prev => ({ ...prev, startDate: startOfDay(date) }))}
                      selectsStart
                      startDate={filters.startDate}
                      endDate={filters.endDate}
                      dateFormat="dd/MM/yyyy"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <DatePicker
                      selected={filters.endDate}
                      onValueChange={(date) => setFilters(prev => ({ ...prev, endDate: endOfDay(date) }))}
                      selectsEnd
                      startDate={filters.startDate}
                      endDate={filters.endDate}
                      minDate={filters.startDate}
                      dateFormat="dd/MM/yyyy"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </div>

                <ScrollArea className="h-[600px] rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Transfer #</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Type</TableHead>
                        {/* <TableHead>Product Code</TableHead>
                        <TableHead>Product Name</TableHead> */}
                        <TableHead>Total Qty</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date/Time</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transferHistory.map((transfer) => {
                        const isDestination = user.role === 'admin' || (transfer.destinationWarehouseId.toString() === userWarehouseId && userWarehouseId);
                        const totalQty = transfer.lots.reduce((sum, l) => sum + l.quantity, 0);
                        // Determine Type: OUT if source warehouse matches user's warehouse, else IN
                        const userWarehouse = warehouses.find(w => w._id.toString() === userWarehouseId);
                        const sourceWarehouse = transfer.sourceWarehouseId?.name;
                        const isOut = userWarehouse?.name === sourceWarehouse;
                        return (
                          <TableRow key={transfer._id}>
                            <TableCell className="font-medium">{transfer.transferNumber}</TableCell>
                            <TableCell>{transfer.sourceWarehouseId?.name || 'N/A'}</TableCell>
                            <TableCell>{transfer.destinationWarehouseId?.name || 'N/A'}</TableCell>
                            <TableCell>
                              {isOut ? (
                                <span className="px-2 py-1 rounded-full bg-red-500 text-white text-xs font-semibold">OUT</span>
                              ) : (
                                <span className="px-2 py-1 rounded-full bg-green-500 text-white text-xs font-semibold">IN</span>
                              )}
                            </TableCell>

                            {/* <TableCell>{transfer.lots.map(l => l.lotId?.productId?.productCode || 'N/A').join(', ') || 'N/A'}</TableCell>
                            <TableCell>{transfer.lots.map(l => l.lotId?.productId?.name || 'N/A').join(', ') || 'N/A'}</TableCell> */}

                            <TableCell>{totalQty}</TableCell>
                            <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                            <TableCell>{format(new Date(transfer.createdAt), 'dd-MM-yyyy, HH:mm')}</TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => generatePDF(transfer)}
                                className="bg-gray-800 text-white hover:bg-gray-700 text-xs"
                              >
                                View PDF
                              </Button>
                              {isDestination && transfer.status === 'Pending' && (
                                <>
                                  {isOut ? (
                                    ""
                                  ) : (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => handleConfirmTransfer(transfer._id)}
                                      className="bg-green-600 text-white hover:bg-green-700 text-xs"
                                    >
                                      Confirm
                                    </Button>
                                  )}
                                  {isOut ? (
                                    ""
                                  ) : (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleRejectTransfer(transfer._id)}
                                      className="text-xs"
                                    >
                                      Reject
                                    </Button>
                                  )}
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Confirm Stock Transfer</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Total Items</Label>
                  <p className="font-medium">{addedItems.length}</p>
                </div>
                <div className="space-y-2">
                  <Label>Total Quantity</Label>
                  <p className="font-medium">{addedItems.reduce((sum, item) => sum + Number(item.quantity), 0)}</p>
                </div>
                <div className="space-y-2">
                  <Label>Source Warehouse</Label>
                  <p className="font-medium">{warehouses.find(w => w._id.toString() === sourceWarehouse)?.name || 'N/A'}</p>
                </div>
                <div className="space-y-2">
                  <Label>Destination Warehouse</Label>
                  <p className="font-medium">{warehouses.find(w => w._id.toString() === destinationWarehouse)?.name || 'N/A'}</p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={cancelTransfer} disabled={isLoading}>
                  Cancel
                </Button>
                <Button onClick={confirmTransfer} disabled={isLoading}>
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

export default TransferOrder;