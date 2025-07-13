import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { startOfDay, endOfDay, format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const IssueHistory = () => {
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  // Initialize dates with start and end of current day
  const [startDate, setStartDate] = useState(startOfDay(new Date())); // 00:00 (UTC)
  const [endDate, setEndDate] = useState(endOfDay(new Date())); // 23:59 (UTC)

  const [filters, setFilters] = useState({
    type: 'all',
    warehouse: 'all',
    searchUser: '',
    searchTransaction: ''
  });

  // Initialize user and fetch data
  const initializeUser = () => {
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser(payload);
      setUserId(payload.id);
    } catch (error) {
      console.error('Error parsing token:', error);
      toast.error('Invalid token, please log in again');
      navigate('/login');
    }
  };

  useEffect(() => {
    initializeUser();
    fetchData();
    fetchWarehouses();
  }, [token, navigate]);

  const fetchWarehouses = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get('http://localhost:3000/api/warehouses', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWarehouses(data);
    } catch (error) {
      toast.error('Failed to load warehouses');
    }
  };

  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      console.log('Fetching with startDate:', startDate.toISOString(), 'endDate:', endDate.toISOString());
      const { data } = await axios.get('http://localhost:3000/api/issue-history', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          type: filters.type !== 'all' ? filters.type : undefined,
          warehouse: filters.warehouse !== 'all' ? filters.warehouse : undefined,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }
      });
      
      const enrichedHistory = await Promise.all(data.map(async (transaction) => {
        const lotsWithDetails = await Promise.all(transaction.lots.map(async (lot) => {
          try {
            const response = await axios.get(`http://localhost:3000/api/lots/${lot.lotId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const dbLot = response.data;
            return {
              ...lot,
              productCode: dbLot.productCode || 'N/A',
              productName: dbLot.productName || 'N/A',
              lotCode: dbLot.lotCode || 'N/A',
              productionDate: dbLot.productionDate || null,
              expDate: dbLot.expDate || null
            };
          } catch (error) {
            console.error(`Failed to fetch lot ${lot.lotId}:`, error);
            return {
              ...lot,
              productCode: 'N/A',
              productName: 'N/A',
              lotCode: 'N/A',
              productionDate: null,
              expDate: null
            };
          }
        }));
        return { ...transaction, lots: lotsWithDetails };
      }));
      
      setHistory(enrichedHistory);
      setFilteredHistory(enrichedHistory);
      setCurrentPage(1); // Reset to first page when new data loads
    } catch (error) {
      toast.error('Failed to load issue history');
    } finally {
      setIsLoading(false);
    }
  };

  // Apply search filters
  useEffect(() => {
    let results = [...history];
    
    if (filters.searchUser) {
      results = results.filter(t => 
        t.userId.username.toLowerCase().includes(filters.searchUser.toLowerCase())
      );
    }
    
    if (filters.searchTransaction) {
      results = results.filter(t => 
        t.transactionNumber.toLowerCase().includes(filters.searchTransaction.toLowerCase())
      );
    }
    
    setFilteredHistory(results);
    setCurrentPage(1); // Reset to first page when filters change
  }, [history, filters.searchUser, filters.searchTransaction]);

  // Handle pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredHistory.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  const handleCancel = async (transactionId) => {
    if (!userId) {
      toast.error('User not authenticated, please log in again');
      return;
    }

    setIsLoading(false);
    setConfirmCancel(null);

    try {
      const response = await axios.patch(
        `http://localhost:3000/api/issue-history/${transactionId}/cancel`,
        { cancelledBy: userId, cancelledDate: new Date() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message);
      fetchData();
    } catch (error) {
      toast.error('Failed to cancel transaction');
      console.error('Error cancelling transaction:', error.response ? error.response.data : error);
    }
  };

  const generatePDF = (transaction) => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Transaction Details Report', 10, 10);
    doc.setFontSize(12);
    doc.text(`Transaction #: ${transaction.transactionNumber}`, 10, 20);
    doc.text(`Date/Time: ${new Date(transaction.createdAt).toLocaleString()}`, 10, 30);
    doc.text(`User: ${transaction.userId.username}`, 10, 40);
    doc.text(`Issue Type: ${transaction.type}`, 10, 50);
    doc.text(`Warehouse: ${transaction.warehouseId.name}`, 10, 60);
    doc.text(`Status: ${transaction.status}`, 10, 70);
    doc.text(`Cancel By: ${transaction.cancelledBy ? transaction.cancelledBy.username || 'Unknown' : 'N/A'}`, 10, 80);
    doc.text(`Canceled Date: ${transaction.cancelledDate ? new Date(transaction.cancelledDate).toLocaleString() : 'N/A'}`, 10, 90);

    // Add table header for lots
    const startY = 100;
    doc.setFontSize(10);
    doc.text('Lots Details:', 10, startY);
    doc.text('Product Code', 10, startY + 10);
    doc.text('Product Name', 40, startY + 10);
    doc.text('Lot Code', 70, startY + 10);
    doc.text('Quantity', 100, startY + 10);
    doc.text('Production Date', 120, startY + 10);
    doc.text('Expiration Date', 150, startY + 10);

    // Add lots data
    let y = startY + 20;
    transaction.lots.forEach((lot, index) => {
      doc.text(lot.productCode || 'N/A', 10, y + (index * 10));
      doc.text(lot.productName || 'N/A', 40, y + (index * 10));
      doc.text(lot.lotCode || 'N/A', 70, y + (index * 10));
      doc.text(String(lot.quantity), 100, y + (index * 10));
      doc.text(lot.productionDate ? new Date(lot.productionDate).toLocaleDateString() : 'N/A', 120, y + (index * 10));
      doc.text(lot.expDate ? new Date(lot.expDate).toLocaleDateString() : 'N/A', 150, y + (index * 10));
    });

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  };

  const exportToExcel = () => {
    const excelData = history.map(transaction => ({
      'Transaction #': transaction.transactionNumber,
      'Date/Time': new Date(transaction.createdAt).toLocaleString(),
      'Issue Type': transaction.type,
      'User': transaction.userId.username,
      'Total Qty': transaction.lots.reduce((sum, l) => sum + l.quantity, 0),
      'Warehouse': transaction.warehouseId.name,
      'Status': transaction.status,
      'Cancel By': transaction.cancelledBy ? transaction.cancelledBy.username || 'Unknown' : 'N/A',
      'Canceled Date': transaction.cancelledDate ? new Date(transaction.cancelledDate).toLocaleString() : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Issue History');
    XLSX.writeFile(workbook, 'IssueHistory.xlsx');
  };

  const handleConfirmCancel = (transactionId) => {
    const transaction = history.find(t => t._id === transactionId);
    if (transaction) {
      setConfirmCancel({
        id: transactionId,
        transactionNumber: transaction.transactionNumber,
        warehouse: transaction.warehouseId.name,
        issueType: transaction.type,
        totalQty: transaction.lots.reduce((sum, l) => sum + l.quantity, 0)
      });
    }
  };

  const closeModal = () => {
    setConfirmCancel(null);
  };

  const clearFilters = () => {
    setFilters(prev => ({
      ...prev,
      type: 'all',
      warehouse: 'all',
      searchUser: '',
      searchTransaction: ''
    }));
    setStartDate(startOfDay(new Date()));
    setEndDate(endOfDay(new Date()));
    fetchData();
  };

  const getIssueTypeColor = (type) => {
    const colors = {
      Sale: 'bg-blue-100 text-blue-800',
      Waste: 'bg-red-100 text-red-800',
      Welfares: 'bg-purple-100 text-purple-800',
      Activities: 'bg-green-100 text-green-800',
      Transfer: 'bg-yellow-100 text-yellow-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (!token) return null;

  return (
    <div className="p-4 md:p-6 max-w-screen-2xl mx-auto bg-gray-50 rounded-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Issue History</h2>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border border-gray-200">
          {/* Filters Section */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
              <Select
                value={filters.type}
                onValueChange={value => setFilters({ ...filters, type: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Sale">Sale</SelectItem>
                  <SelectItem value="Waste">Waste</SelectItem>
                  <SelectItem value="Welfares">Welfares</SelectItem>
                  <SelectItem value="Activities">Activities</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
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
                    <SelectItem key={w._id} value={w._id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <DatePicker
                selected={startDate}
                onChange={date => setStartDate(startOfDay(date))}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                dateFormat="dd/MM/yyyy"
                className="w-full p-2 border rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <DatePicker
                selected={endDate}
                onChange={date => setEndDate(endOfDay(date))}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate}
                dateFormat="dd/MM/yyyy"
                className="w-full p-2 border rounded-md"
              />
            </div>
          </div>
          
          {/* Search Section */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search User</label>
              <Input
                type="text"
                placeholder="Search by username..."
                value={filters.searchUser}
                onChange={e => setFilters({ ...filters, searchUser: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Transaction</label>
              <Input
                type="text"
                placeholder="Search by transaction #..."
                value={filters.searchTransaction}
                onChange={e => setFilters({ ...filters, searchTransaction: e.target.value })}
              />
            </div>
            
            <div className="flex items-end space-x-2">
              <Button onClick={fetchData} className="bg-blue-600 hover:bg-blue-700">
                Apply Filters
              </Button>
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
              <Button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700 ml-auto">
                Export Excel
              </Button>
            </div>
          </div>
          
          {/* Table Section */}
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Transaction #</TableHead>
                  <TableHead>Issue Type</TableHead>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Total Qty</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cancel By</TableHead>
                  <TableHead>Canceled Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.length > 0 ? (
                  currentItems.map(transaction => (
                    <TableRow key={transaction._id}>
                      <TableCell className="font-medium">{transaction.transactionNumber}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${getIssueTypeColor(transaction.type)}`}>
                          {transaction.type}
                        </span>
                      </TableCell>
                      <TableCell>{format(new Date(transaction.createdAt), 'dd-MM-yyyy, HH:mm:ss').toLocaleString()}</TableCell>
                      <TableCell>{transaction.userId.username}</TableCell>
                      <TableCell>{transaction.lots.reduce((sum, l) => sum + l.quantity, 0)}</TableCell>
                      <TableCell>{transaction.warehouseId.name}</TableCell>
                      <TableCell className={transaction.status === 'Active' ? 'text-green-600' : 'text-red-600'}>
                        {transaction.status}
                      </TableCell>
                      <TableCell>{transaction.cancelledBy ? transaction.cancelledBy.username || 'Unknown' : '-'}</TableCell>
                      <TableCell >{transaction.cancelledDate ? new Date(transaction.cancelledDate).toLocaleString() : '-'}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => generatePDF(transaction)}
                        >
                          View PDF
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleConfirmCancel(transaction._id)}
                          disabled={!userId || !user || user.role !== 'admin' || transaction.status !== 'Active'}
                        >
                          Cancel
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-4">
                      No transactions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {filteredHistory.length > itemsPerPage && (
            <div className="mt-4">
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
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {confirmCancel && (
        <Dialog open={true} onOpenChange={closeModal}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Confirm Cancel Transaction</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Transaction #</p>
                  <p>{confirmCancel.transactionNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Warehouse</p>
                  <p>{confirmCancel.warehouse}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Issue Type</p>
                  <p>{confirmCancel.issueType}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Qty</p>
                  <p>{confirmCancel.totalQty}</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeModal}>Cancel</Button>
              <Button 
                onClick={() => { 
                  handleCancel(confirmCancel.id); 
                  closeModal(); 
                }}
              >
                Confirm Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default IssueHistory;