import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { startOfDay, endOfDay, format } from 'date-fns';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';

const ManageDamage = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [lots, setLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [damageHistory, setDamageHistory] = useState([]);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const user = token ? JSON.parse(atob(token.split('.')[1])) : {};
  const isAdmin = user.role === 'admin';
  const [filters, setFilters] = useState({
    startDate: startOfDay(new Date()),
    endDate: endOfDay(new Date()),
    warehouse: 'all',
    user: '',
    transaction: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter and paginate damageHistory
  const filteredHistory = damageHistory.filter(record => {
    const startDateMatch = !filters.startDate || new Date(record.timestamp) >= filters.startDate;
    const endDateMatch = !filters.endDate || new Date(record.timestamp) <= filters.endDate;
    const warehouseMatch = filters.warehouse === 'all' || record.lotId?.warehouseId?._id?.toString() === filters.warehouse;
    const userMatch = !filters.user || (record.userId?.username?.toLowerCase()?.includes(filters.user.toLowerCase()) || false);
    const transactionMatch = !filters.transaction || record.transactionNumber?.toLowerCase()?.includes(filters.transaction.toLowerCase());
    return startDateMatch && endDateMatch && warehouseMatch && userMatch && transactionMatch;
  });
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredHistory.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWarehouse || !selectedLot || !quantity || !reason) {
      setError('Please fill all required fields');
      return;
    }
    if (parseInt(quantity) <= 0) {
      setError('Quantity must be positive');
      return;
    }
    setIsLoading(true);
    try {
      const response = await axios.post(
        'http://localhost:3000/api/manage-damage',
        { lotId: selectedLot, quantity: parseInt(quantity), reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message);
      setShowAddModal(false);
      setSelectedWarehouse('');
      setSelectedProduct('');
      setSelectedLot('');
      setQuantity('');
      setReason('');
      setError('');
      fetchDamageHistory();
    } catch (error) {
      setError(error.response?.data?.message || 'Error marking as damaged');
      console.error('Error details:', error.response?.data);
    } finally {
      setIsLoading(false);
    }
  };

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

    fetchWarehouses();
    fetchDamageHistory();
  }, [token, navigate]);

  const fetchWarehouses = async () => {
    setIsLoading(true);
    try {
      const { data } = await axios.get('http://localhost:3000/api/warehouses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWarehouses(data);
      if (!isAdmin && user.warehouse) {
        const defaultWarehouseId = typeof user.warehouse === 'object' && user.warehouse._id
          ? user.warehouse._id.toString()
          : user.warehouse.toString();
        setSelectedWarehouse(defaultWarehouseId);
        fetchProducts(defaultWarehouseId);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load warehouses');
      if (error.response?.status === 401) navigate('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async (warehouseId) => {
    setIsLoading(true);
    try {
      if (!warehouseId) {
        setProducts([]);
        setSelectedProduct('');
        setLots([]);
        setSelectedLot('');
        setQuantity('');
        setReason('');
        setError('');
        return;
      }
      const { data } = await axios.get(`http://localhost:3000/api/products?warehouse=${warehouseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(data || []);
      setSelectedProduct('');
      setLots([]);
      setSelectedLot('');
      setQuantity('');
      setReason('');
      setError('');
    } catch (error) {
      console.error('Error fetching products:', error.response || error);
      toast.error(error.response?.data?.message || 'Failed to load products. Please ensure the warehouse has associated products.');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLots = async (productId) => {
    setIsLoading(true);
    try {
      if (!productId || !selectedWarehouse) {
        setLots([]);
        setSelectedLot('');
        setQuantity('');
        setReason('');
        setError('');
        return;
      }
      const { data } = await axios.get(`http://localhost:3000/api/lots?productId=${productId}&warehouse=${selectedWarehouse}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLots(data || []);
      setSelectedLot('');
      setQuantity('');
      setReason('');
      setError('');
    } catch (error) {
      console.error('Error fetching lots:', error.response || error);
      toast.error(error.response?.data?.message || 'Failed to load lots');
      setLots([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDamageHistory = async () => {
    setIsLoading(true);
    try {
      const params = {
        warehouse: filters.warehouse !== 'all' ? filters.warehouse : undefined,
        startDate: filters.startDate ? filters.startDate.toISOString() : undefined,
        endDate: filters.endDate ? filters.endDate.toISOString() : undefined,
        user: filters.user || undefined,
        transaction: filters.transaction || undefined
      };
      const { data } = await axios.get('http://localhost:3000/api/manage-damage/history', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setDamageHistory(data.map(record => ({
        ...record,
        lotId: {
          ...record.lotId,
          productId: record.lotId?.productId || { name: 'N/A', productCode: 'N/A' },
          warehouseId: record.lotId?.warehouse || { name: 'N/A' }
        }
      })));
      setCurrentPage(1);
    } catch (error) {
      toast.error('Failed to load damage history');
      console.error('Fetch damage history error:', error.response?.data);
    } finally {
      setIsLoading(false);
    }
  };

  let assignedWarehouseId = '';
  if (user.warehouse) {
    assignedWarehouseId = typeof user.warehouse === 'object' && user.warehouse._id
      ? user.warehouse._id.toString()
      : user.warehouse.toString();
  }
  const visibleWarehouses = isAdmin
    ? warehouses
    : warehouses.filter(w => w._id && w._id.toString() === assignedWarehouseId);

  if (!token) return null;
  console.log("====>", currentItems)
  return (
    <div className="p-6 max-w-screen-2xl mx-auto">
      <div className="flex flex-col space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Damage Management</h1>
            <p className="text-muted-foreground">Track and manage damaged inventory items</p>
          </div>
          <Button
            variant="destructive"
            size="lg"
            onClick={() => setShowAddModal(true)}
            className="gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Report Damage
          </Button>
        </div>

        {/* Add Damage Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-5/12">
            <DialogHeader>
              <DialogTitle>Report Damaged Items</DialogTitle>
              <DialogDescription>
                Record damaged inventory with details for tracking and analysis
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="warehouse">Warehouse *</Label>
                  <Select
                    value={selectedWarehouse}
                    onValueChange={(value) => {
                      setSelectedWarehouse(value);
                      fetchProducts(value);
                    }}
                    disabled={isLoading || (!isAdmin && user.warehouse)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleWarehouses.map(w => (
                        <SelectItem key={w._id} value={w._id.toString()}>
                          {w.name} ({w.warehouseCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product">Product *</Label>
                  <Select
                    value={selectedProduct}
                    onValueChange={(value) => {
                      setSelectedProduct(value);
                      fetchLots(value);
                    }}
                    disabled={isLoading || !selectedWarehouse}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(product => (
                        <SelectItem key={product._id} value={product._id}>
                          {product.name} ({product.productCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lot">Lot Code *</Label>
                  <Select
                    value={selectedLot}
                    onValueChange={setSelectedLot}
                    disabled={isLoading || !selectedProduct}
                  >
                    <SelectTrigger className="w-full" >
                      <SelectValue placeholder="Select lot code" />
                    </SelectTrigger>
                    <SelectContent>
                      {lots.map(lot => (
                        <SelectItem key={lot._id} value={lot._id}>
                          {lot.lotCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    type="number"
                    id="quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    placeholder="Enter quantity"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="reason">Reason *</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe the damage reason..."
                    rows={3}
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isLoading || !selectedWarehouse || !selectedLot || !quantity || !reason}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : 'Submit Damage Report'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Filters Section */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <DatePicker
                  selected={filters.startDate}
                  onChange={date => setFilters({ ...filters, startDate: startOfDay(date) })}
                  selectsStart
                  startDate={filters.startDate}
                  endDate={filters.endDate}
                  dateFormat="dd/MM/yyyy"
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <DatePicker
                  selected={filters.endDate}
                  onChange={date => setFilters({ ...filters, endDate: endOfDay(date) })}
                  selectsEnd
                  startDate={filters.startDate}
                  endDate={filters.endDate}
                  minDate={filters.startDate}
                  dateFormat="dd/MM/yyyy"
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div className="space-y-2">
                <Label>Warehouse</Label>
                <Select
                  value={filters.warehouse}
                  onValueChange={value => setFilters({ ...filters, warehouse: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Warehouses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Warehouses</SelectItem>
                    {warehouses.map(w => (
                      <SelectItem key={w._id} value={w._id.toString()}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>User</Label>
                <Input
                  placeholder="Search by username..."
                  value={filters.user}
                  onChange={e => setFilters({ ...filters, user: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Transaction #</Label>
                <Input
                  placeholder="Search by transaction #..."
                  value={filters.transaction}
                  onChange={e => setFilters({ ...filters, transaction: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Button onClick={() => fetchDamageHistory()}>
                Apply Filters
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const newFilters = {
                    startDate: startOfDay(new Date()),
                    endDate: endOfDay(new Date()),
                    warehouse: 'all',
                    user: '',
                    transaction: ''
                  };
                  setFilters(newFilters);
                  setIsLoading(true);
                  try {
                    const { data } = await axios.get('http://localhost:3000/api/manage-damage/history', {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    setDamageHistory(data.map(record => ({
                      ...record,
                      lotId: {
                        ...record.lotId,
                        productId: record.lotId?.productId || { name: 'N/A', productCode: 'N/A' },
                        warehouseId: record.lotId?.warehouse || { name: 'N/A' }
                      }
                    })));
                    setCurrentPage(1);
                  } catch (error) {
                    toast.error('Failed to load damage history');
                  } finally {
                    setIsLoading(false);
                  }
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Damage History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Damage History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction #</TableHead>
                    <TableHead>Lot Code</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.length > 0 ? (
                    currentItems.map((record) => (
                      <TableRow key={record._id}>
                        <TableCell className="font-medium">{record.transactionNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {record.lotId?.lotCode || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{record.lotId?.productId?.name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">
                            {record.lotId?.productId?.productCode || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.lotId?.warehouse?.name || 'N/A'}
                        </TableCell>
                        <TableCell>{record.userId?.username || 'Unknown'}</TableCell>
                        <TableCell className="text-right font-medium text-destructive">
                          {record.quantity}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{record.reason}</TableCell>
                        <TableCell>
                          {format(new Date(record.timestamp), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        No damage records found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {filteredHistory.length > itemsPerPage && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(indexOfLastItem, filteredHistory.length)}</span> of{' '}
                  <span className="font-medium">{filteredHistory.length}</span> results
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            isActive={currentPage === pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default ManageDamage;