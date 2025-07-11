import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import * as Select from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import jsPDF from 'jspdf';

const IssueHistory = () => {
  const [history, setHistory] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [filters, setFilters] = useState({ type: 'all', warehouse: 'all', startDate: '', endDate: '' });
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const user = token ? JSON.parse(atob(token.split('.')[1])) : {};

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchData();
    fetchWarehouses();
  }, [token, navigate]);

  const fetchWarehouses = async () => {
    try {
      const { data } = await axios.get('http://localhost:3000/api/warehouses', { headers: { Authorization: `Bearer ${token}` } });
      setWarehouses(data);
    } catch (error) {
      toast.error('Failed to load warehouses');
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data } = await axios.get('http://localhost:3000/api/issue-history', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          type: filters.type !== 'all' ? filters.type : undefined,
          warehouse: filters.warehouse !== 'all' ? filters.warehouse : undefined,
          startDate: filters.startDate,
          endDate: filters.endDate
        }
      });
      setHistory(data);
    } catch (error) {
      toast.error('Failed to load issue history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async (transactionId) => {
    if (user.role !== 'admin') {
      toast.error('Only admin can cancel transactions');
      return;
    }
    if (window.confirm('Are you sure you want to cancel this transaction?')) {
      setIsLoading(true);
      try {
        // Logic to cancel (to be implemented)
        logger.info('Cancel transaction logic to be implemented', { transactionId });
        toast.success('Transaction cancelled');
        fetchData();
      } catch (error) {
        toast.error('Failed to cancel transaction');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const viewPDF = (transaction) => {
    setSelectedTransaction(transaction);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text('Issue Transaction Details', 10, 10);
    doc.text(`Transaction #: ${selectedTransaction.transactionNumber}`, 10, 20);
    doc.text(`Date/Time: ${new Date(selectedTransaction.createdAt).toLocaleString()}`, 10, 30);
    doc.text(`User: ${selectedTransaction.userId.username}`, 10, 40);
    doc.text(`Issue Type: ${selectedTransaction.type}`, 10, 50);
    doc.text(`Warehouse: ${selectedTransaction.warehouseId.name}`, 10, 60);
    doc.text(`Status: ${selectedTransaction.status}`, 10, 70);

    let y = 80;
    selectedTransaction.lots.forEach((lot, index) => {
      doc.text(`Product Code: ${lot.productCode}`, 10, y + index * 10);
      doc.text(`Product: ${lot.productName}`, 40, y + index * 10);
      doc.text(`Lot Code: ${lot.lotCode}`, 70, y + index * 10);
      doc.text(`Qty: ${lot.quantity}`, 100, y + index * 10);
      doc.text(`Production Date: ${new Date(lot.productionDate).toLocaleDateString()}`, 120, y + index * 10);
      doc.text(`Expiration Date: ${new Date(lot.expDate).toLocaleDateString()}`, 150, y + index * 10);
    });

    doc.output('dataurlnewwindow'); // เปิดในหน้าต่างใหม่
  };

  if (!token) return null;

  return (
    <div className="p-6 max-w-screen mx-auto bg-gray-50 rounded-xl">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Issue History</h2>
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
              <Select.Root value={filters.type} onValueChange={value => setFilters({ ...filters, type: value })}>
                <Select.Trigger className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg">
                  <Select.Value placeholder="All Types" />
                  <Select.Icon className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <ChevronDownIcon />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All Types</Select.Item>
                  <Select.Item value="Sale">Sale</Select.Item>
                  <Select.Item value="Waste">Waste</Select.Item>
                  <Select.Item value="Welfares">Welfares</Select.Item>
                  <Select.Item value="Activities">Activities</Select.Item>
                  <Select.Item value="Transfer">Transfer</Select.Item>
                </Select.Content>
              </Select.Root>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
              <Select.Root value={filters.warehouse} onValueChange={value => setFilters({ ...filters, warehouse: value })}>
                <Select.Trigger className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg">
                  <Select.Value placeholder="All Warehouses" />
                  <Select.Icon className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <ChevronDownIcon />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All Warehouses</Select.Item>
                  {warehouses.map(w => (
                    <Select.Item key={w._id} value={w._id}>
                      {w.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <Button onClick={fetchData} className="mb-4 bg-blue-600 text-white">Apply Filters</Button>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warehouse</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map(transaction => (
                  <tr key={transaction._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">{transaction.transactionNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{transaction.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(transaction.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{transaction.userId.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{transaction.lots.reduce((sum, l) => sum + l.quantity, 0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{transaction.warehouseId.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{transaction.status}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button onClick={() => viewPDF(transaction)} className="text-blue-600 hover:text-blue-900 mr-2">View PDF</Button>
                      {user.role === 'admin' && transaction.status === 'Active' && (
                        <Button onClick={() => handleCancel(transaction._id)} className="text-red-600 hover:text-red-900">Cancel</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p><strong>Transaction #:</strong> {selectedTransaction?.transactionNumber}</p>
            <p><strong>Date/Time:</strong> {selectedTransaction ? new Date(selectedTransaction.createdAt).toLocaleString() : ''}</p>
            <p><strong>User:</strong> {selectedTransaction?.userId.username}</p>
            <p><strong>Issue Type:</strong> {selectedTransaction?.type}</p>
            <p><strong>Warehouse:</strong> {selectedTransaction?.warehouseId.name}</p>
            <p><strong>Status:</strong> {selectedTransaction?.status}</p>
            {selectedTransaction?.lots.map((lot, index) => (
              <div key={index} className="ml-4">
                <p><strong>Product Code:</strong> {lot.productCode}</p>
                <p><strong>Product:</strong> {lot.productName}</p>
                <p><strong>Lot Code:</strong> {lot.lotCode}</p>
                <p><strong>Qty:</strong> {lot.quantity}</p>
                <p><strong>Production Date:</strong> {new Date(lot.productionDate).toLocaleDateString()}</p>
                <p><strong>Expiration Date:</strong> {new Date(lot.expDate).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={generatePDF}>Generate PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
    </div>
  );
};

export default IssueHistory;