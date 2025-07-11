import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import * as Select from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const TransferOrder = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [lots, setLots] = useState([]);
  const [currentItem, setCurrentItem] = useState({
    lotId: '',
    quantity: ''
  });
  const [addedItems, setAddedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
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
      const [warehousesRes, productsRes] = await Promise.all([
        axios.get('http://localhost:3000/api/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:3000/api/products', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setWarehouses(warehousesRes.data);
      setProducts(productsRes.data);

      const defaultWarehouse = user.role !== 'admin' ? user.warehouse : warehousesRes.data[0]?._id;
      setSelectedWarehouse(defaultWarehouse);
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
      setLots(data.filter(lot => lot.qtyOnHand > 0));
      setCurrentItem(prev => ({ ...prev, lotId: '', quantity: '' }));
    } catch (error) {
      toast.error('Failed to load lots');
    }
  };

  const addItem = () => {
    if (!currentItem.lotId || !currentItem.quantity) {
      toast.error('Please fill all required fields');
      return;
    }
    const lot = lots.find(l => l._id === currentItem.lotId);
    if (Number(currentItem.quantity) > lot.qtyOnHand) {
      toast.error(`Quantity exceeds available stock (${lot.qtyOnHand})`);
      return;
    }
    setAddedItems([...addedItems, { ...currentItem, productName: products.find(p => p._id === lot.productId)?.name }]);
    setCurrentItem({ lotId: '', quantity: '' });
  };

  const removeItem = index => {
    setAddedItems(addedItems.filter((_, i) => i !== index));
  };

  const handleTransfer = async () => {
    if (addedItems.length === 0 || !selectedDestination) {
      toast.error('Please add items and select destination warehouse');
      return;
    }
    const totalItems = addedItems.length;
    const totalQuantity = addedItems.reduce((sum, item) => sum + Number(item.quantity), 0);
    const destinationName = warehouses.find(w => w._id === selectedDestination)?.name;
    setShowConfirmModal(true);
  };

  const confirmTransfer = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);
    try {
      const payload = {
        lots: addedItems.map(item => ({ lotId: item.lotId, quantity: Number(item.quantity) })),
        type: 'Transfer',
        warehouse: selectedWarehouse,
        destinationWarehouseId: selectedDestination,
        note: ''
      };
      const response = await axios.post('http://localhost:3000/api/issue', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message);
      setAddedItems([]);
      setSelectedDestination('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to transfer stock');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelTransfer = () => {
    setShowConfirmModal(false);
  };

  if (!token) return null;

  return (
    <div className="p-6 max-w-screen mx-auto bg-gray-50 rounded-xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Transfer Order</h2>
        <div className="flex space-x-3">
          <Button
            onClick={handleTransfer}
            disabled={isLoading || addedItems.length === 0 || !selectedDestination}
            className={`px-4 py-2 text-sm font-medium rounded-lg shadow-sm ${isLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'}`}
          >
            {isLoading ? 'Processing...' : 'Confirm Transfer'}
          </Button>
        </div>
      </div>

      {isLoading && !products.length ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Warehouse</label>
                <Select.Root
                  value={selectedWarehouse}
                  onValueChange={setSelectedWarehouse}
                  disabled={user.role !== 'admin' || isLoading}
                >
                  <Select.Trigger
                    className={`${user.role === 'user' ? 'bg-gray-200 text-gray-500' : 'bg-white'} mt-1 block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-lg appearance-none hover:bg-gray-100 transition-colors duration-200`}
                  >
                    <Select.Value placeholder="Select source warehouse" />
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
                            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 cursor-pointer focus:bg-green-100 m-2 rounded-sm focus:outline-none"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination Warehouse</label>
                <Select.Root
                  value={selectedDestination}
                  onValueChange={setSelectedDestination}
                  disabled={isLoading || !selectedWarehouse}
                >
                  <Select.Trigger
                    className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-lg appearance-none bg-white hover:bg-gray-100 transition-colors duration-200"
                  >
                    <Select.Value placeholder="Select destination warehouse" />
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
                        {warehouses.filter(w => w._id !== selectedWarehouse).map(w => (
                          <Select.Item
                            key={w._id}
                            value={w._id}
                            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 cursor-pointer focus:bg-green-100 m-2 rounded-sm focus:outline-none"
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
                    className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-lg appearance-none bg-white hover:bg-gray-100 transition-colors duration-200"
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
                        {products.map(product => (
                          <Select.Item
                            key={product._id}
                            value={product._id}
                            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 cursor-pointer focus:bg-green-100 m-2 rounded-sm focus:outline-none"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Lot</label>
                <Select.Root
                  value={currentItem.lotId}
                  onValueChange={(value) => setCurrentItem(prev => ({ ...prev, lotId: value }))}
                  disabled={isLoading || !selectedProduct}
                >
                  <Select.Trigger
                    className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-lg appearance-none bg-white hover:bg-gray-100 transition-colors duration-200"
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
                            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 cursor-pointer focus:bg-green-100 m-2 rounded-sm focus:outline-none"
                          >
                            <Select.ItemText>{lot.lotCode} (Qty: {lot.qtyOnHand})</Select.ItemText>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  value={currentItem.quantity}
                  onChange={e => setCurrentItem(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder="Enter quantity"
                  className="mt-1 block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  min="1"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-4">
              <Button
                onClick={addItem}
                disabled={isLoading || !currentItem.lotId || !currentItem.quantity}
                className="px-4 py-2 text-sm font-medium rounded-lg shadow-sm bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Add Item
              </Button>
            </div>
          </div>

          {addedItems.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Items to Transfer ({addedItems.length})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available Qty</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {addedItems.map((item, index) => {
                      const lot = lots.find(l => l._id === item.lotId);
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.productName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot?.lotCode}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lot?.qtyOnHand}</td>
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
                <DialogTitle>Confirm Stock Transfer</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <p><strong>Total Stock Items Transfer:</strong> {addedItems.length}</p>
                <p><strong>Total Items:</strong> {addedItems.length}</p>
                <p><strong>Total Quantity:</strong> {addedItems.reduce((sum, item) => sum + Number(item.quantity), 0)}</p>
                <p><strong>Destination Warehouse:</strong> {warehouses.find(w => w._id === selectedDestination)?.name || 'N/A'}</p>
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