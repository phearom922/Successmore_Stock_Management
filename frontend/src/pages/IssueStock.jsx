import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import * as Select from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const IssueStock = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [lots, setLots] = useState([]);
  const [currentItem, setCurrentItem] = useState({
    lotId: '',
    quantity: '',
    transactionType: 'Sale'
  });
  const [addedItems, setAddedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isManualSelection, setIsManualSelection] = useState(false);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const user = token ? JSON.parse(atob(token.split('.')[1])) : {};

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [token, navigate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [warehousesRes, productsRes, categoriesRes] = await Promise.all([
        axios.get('http://localhost:3000/api/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:3000/api/products', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:3000/api/categories', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setWarehouses(warehousesRes.data);
      setProducts(productsRes.data.map(p => ({ ...p, _id: p._id.toString() })));
      setCategories(categoriesRes.data);
      console.log('Fetched Products:', productsRes.data);

      const defaultWarehouse = user.role !== 'admin' ? user.warehouse : warehousesRes.data[0]?._id;
      if (!defaultWarehouse) {
        toast.error('No warehouse assigned or available');
        return;
      }
      setSelectedWarehouse(defaultWarehouse);
      console.log('Default Warehouse set to:', defaultWarehouse);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load data');
      if (error.response?.status === 401) navigate('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLots = async (productId) => {
    if (!productId || !selectedWarehouse) return;
    try {
      const { data } = await axios.get('http://localhost:3000/api/lots', {
        headers: { Authorization: `Bearer ${token}` },
        params: { productId, warehouse: selectedWarehouse }
      });
      const filteredLots = data.filter(lot => lot.warehouse.toString() === selectedWarehouse && lot.qtyOnHand > 0);
      const sortedLots = filteredLots.sort((a, b) => new Date(a.expDate) - new Date(b.expDate));
      setLots(sortedLots);
      console.log('Fetched and Sorted Lots for Product:', productId, sortedLots);
      if (!isManualSelection && sortedLots.length > 0) {
        setCurrentItem(prev => ({ ...prev, lotId: sortedLots[0]._id }));
      }
    } catch (error) {
      toast.error('Failed to load lots');
    }
  };

  const addItem = () => {
    const quantity = Number(currentItem.quantity);
    if (!quantity || !currentItem.transactionType) {
      toast.error('Please fill all required fields');
      return;
    }

    let remainingQuantity = quantity;
    const selectedLots = [];
    let currentLots = [...lots]; // คัดลอก lots เพื่อไม่กระทบ State เดิม

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
        lotId: lot._id,
        quantity: qtyToTake,
        transactionType: currentItem.transactionType,
        productName: product?.name || 'Unknown',
        productCode: product?.productCode || 'N/A',
        lotCode: lot.lotCode,
        prodDate: lot.productionDate,
        expDate: lot.expDate
      });

      remainingQuantity -= qtyToTake;
      currentLots = currentLots.filter(l => l._id.toString() !== lot._id); // ลบ Lot ที่ใช้ไปแล้ว
    }

    if (remainingQuantity > 0) {
      toast.error('Insufficient stock across all lots');
      return;
    }

    setAddedItems(prevItems => [...prevItems, ...selectedLots]);
    setSelectedProduct('');
    setCurrentItem({ lotId: '', quantity: '', transactionType: 'Sale' });
    fetchLots(''); // รีเซ็ต lots
  };

  const removeItem = index => {
    setAddedItems(addedItems.filter((_, i) => i !== index));
  };

  const handleIssue = async () => {
    if (addedItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    const totalItems = addedItems.length;
    const totalQuantity = addedItems.reduce((sum, item) => sum + Number(item.quantity), 0);
    setShowConfirmModal(true);
  };

  const confirmIssue = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);
    try {
      const payload = {
        lots: addedItems.map(item => ({ lotId: item.lotId, quantity: Number(item.quantity) })),
        type: addedItems[0].transactionType,
        warehouse: selectedWarehouse,
        note: ''
      };
      console.log('Issuing with payload:', JSON.stringify(payload, null, 2));
      const response = await axios.post('http://localhost:3000/api/issue', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message);
      setAddedItems([]);
    } catch (error) {
      console.error('Issue error:', error.response?.data || error);
      toast.error(error.response?.data?.message || 'Failed to issue stock');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelIssue = () => {
    setShowConfirmModal(false);
  };

  const filteredProducts = selectedCategory === 'All'
    ? products
    : products.filter(p => p.category && p.category._id === selectedCategory);

  return (
    <div className="p-6 max-w-screen mx-auto bg-gray-50 rounded-xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Issue Stock</h2>
        <div className="flex space-x-3">
          <Button
            onClick={handleIssue}
            disabled={isLoading || addedItems.length === 0}
            className={`px-4 py-2 text-sm font-medium rounded-lg shadow-sm ${isLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'}`}
          >
            {isLoading ? 'Processing...' : 'Issue Stock'}
          </Button>
        </div>
      </div>

      {isLoading && !products.length ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="mb-6">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="All">All Products</option>
                {categories.map(category => (
                  <option key={category._id} value={category._id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
                <Select.Root
                  value={selectedWarehouse}
                  onValueChange={setSelectedWarehouse}
                  disabled={user.role !== 'admin' || isLoading}
                >
                  <Select.Trigger
                    className={`${user.role === 'user' ? 'bg-gray-200 text-gray-500' : 'bg-white'} mt-1 block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-lg appearance-none hover:bg-gray-100 transition-colors duration-200`}
                  >
                    <Select.Value placeholder="Select warehouse" />
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
                        <Select.Label className="px-3 py-1.5 text-sm text-gray-500">Warehouses</Select.Label>
                        {warehouses.map(w => (
                          <Select.Item
                            key={w._id}
                            value={w._id}
                            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 cursor-pointer focus:bg-red-100 m-2 rounded-sm focus:outline-none"
                            disabled={user.role !== 'admin' && w._id !== user.warehouse}
                          >
                            <Select.ItemText>{w.name} ({w.warehouseCode})</Select.ItemText>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <Select.Root
                  value={selectedProduct}
                  onValueChange={(value) => {
                    setSelectedProduct(value);
                    fetchLots(value);
                  }}
                  disabled={isLoading || !selectedWarehouse}
                >
                  <Select.Trigger
                    className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-lg appearance-none bg-white hover:bg-gray-100 transition-colors duration-200"
                  >
                    <Select.Value placeholder="Select product" />
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
                        <Select.Label className="px-3 py-1.5 text-sm text-gray-500">Products</Select.Label>
                        {filteredProducts.map(product => (
                          <Select.Item
                            key={product._id}
                            value={product._id}
                            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 cursor-pointer focus:bg-red-100 m-2 rounded-sm focus:outline-none"
                          >
                            <Select.ItemText>{product.name} ({product.productCode})</Select.ItemText>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manual Lot Selection</label>
                <input
                  type="checkbox"
                  checked={isManualSelection}
                  onChange={(e) => {
                    setIsManualSelection(e.target.checked);
                    if (!e.target.checked && lots.length > 0) {
                      setCurrentItem(prev => ({ ...prev, lotId: lots[0]._id }));
                    } else {
                      setCurrentItem(prev => ({ ...prev, lotId: '' }));
                    }
                  }}
                  className="mr-2 leading-tight"
                />
                <span>Select Lot Manually</span>
              </div>
              {!isManualSelection && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selected Lot (FEFO)</label>
                  <input
                    type="text"
                    value={lots.length > 0 ? `${lots[0].lotCode} (Qty: ${lots[0].qtyOnHand}, Exp: ${new Date(lots[0].expDate).toLocaleDateString()})` : 'No lots available'}
                    readOnly
                    className="mt-1 block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm bg-gray-100"
                  />
                </div>
              )}
              {isManualSelection && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lot</label>
                  <Select.Root
                    value={currentItem.lotId}
                    onValueChange={(value) => setCurrentItem(prev => ({ ...prev, lotId: value }))}
                    disabled={isLoading || !selectedProduct}
                  >
                    <Select.Trigger
                      className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-lg appearance-none bg-white hover:bg-gray-100 transition-colors duration-200"
                    >
                      <Select.Value placeholder="Select lot" />
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
                          <Select.Label className="px-3 py-1.5 text-sm text-gray-500">Lots</Select.Label>
                          {lots.map(lot => (
                            <Select.Item
                              key={lot._id}
                              value={lot._id}
                              className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 cursor-pointer focus:bg-red-100 m-2 rounded-sm focus:outline-none"
                            >
                              <Select.ItemText>{lot.lotCode} (Qty: {lot.qtyOnHand}, Exp: {new Date(lot.expDate).toLocaleDateString()})</Select.ItemText>
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
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  value={currentItem.quantity}
                  onChange={e => setCurrentItem(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder="Enter quantity"
                  className="mt-1 block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                <Select.Root
                  value={currentItem.transactionType}
                  onValueChange={(value) => setCurrentItem(prev => ({ ...prev, transactionType: value }))}
                  disabled={isLoading}
                >
                  <Select.Trigger
                    className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-lg appearance-none bg-white hover:bg-gray-100 transition-colors duration-200"
                  >
                    <Select.Value placeholder="Select type" />
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
                        <Select.Label className="px-3 py-1.5 text-sm text-gray-500">Types</Select.Label>
                        {['Sale', 'Waste', 'Welfares', 'Activities'].map(type => (
                          <Select.Item
                            key={type}
                            value={type}
                            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 cursor-pointer focus:bg-red-100 m-2 rounded-sm focus:outline-none"
                          >
                            <Select.ItemText>{type}</Select.ItemText>
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
            </div>
            <div className="mt-6 flex justify-end space-x-4">
              <Button
                onClick={addItem}
                disabled={isLoading || !currentItem.quantity || !currentItem.transactionType || (isManualSelection && !currentItem.lotId)}
                className="px-4 py-2 text-sm font-medium rounded-lg shadow-sm bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Add Item
              </Button>
            </div>
          </div>

          {addedItems.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Items to Issue ({addedItems.length})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ProductCode</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ProductName</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prod Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exp Date</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {addedItems.map((item, index) => {
                      const lotInTable = addedItems.find(i => i.lotCode === item.lotCode);
                      const lot = lots.find(l => l._id.toString() === item.lotId) || lotInTable;
                      console.log('Mapping item:', item, 'Lot found:', lot);
                      const productId = lot?.productId?._id?.toString() || lot?.productId?.toString();
                      const product = productId ? products.find(p => p._id === productId) : null;
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product?.productCode || lotInTable?.productCode || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product?.name || lotInTable?.productName || 'Unknown'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.lotCode}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot ? new Date(lot.prodDate || lot.productionDate).toLocaleDateString() : '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot ? new Date(lot.expDate).toLocaleDateString() : '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-900 mr-4"
                              disabled={isLoading}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Confirm Stock Issue</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <p><strong>Total Items:</strong> {addedItems.length}</p>
                <p><strong>Total Quantity:</strong> {addedItems.reduce((sum, item) => sum + Number(item.quantity), 0)}</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={cancelIssue} disabled={isLoading}>
                  Cancel
                </Button>
                <Button onClick={confirmIssue} disabled={isLoading}>
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

export default IssueStock;