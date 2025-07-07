import { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import * as Select from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';

const ManageDamage = () => {
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
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const user = token ? JSON.parse(atob(token.split('.')[1])) : {};
  const [isAdmin] = useState(user.role === 'admin');

  
  // ฟิลเตอร์ warehouse เฉพาะ assignedWarehouse ถ้าไม่ใช่ admin (รองรับ assignedWarehouse เป็น object หรือ string)
  // ฟิลเตอร์ warehouse เฉพาะ assignedWarehouse ถ้าไม่ใช่ admin (รองรับ assignedWarehouse เป็น object, string, หรือ null)
  let assignedWarehouseId = '';
  if (user.assignedWarehouse) {
    if (typeof user.assignedWarehouse === 'object' && user.assignedWarehouse._id) {
      assignedWarehouseId = user.assignedWarehouse._id.toString();
    } else {
      assignedWarehouseId = user.assignedWarehouse.toString();
    }
  }
  const visibleWarehouses = isAdmin
    ? warehouses
    : warehouses.filter(w => w._id && w._id.toString() === assignedWarehouseId);

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
  }, [token, navigate]);

  const fetchWarehouses = async () => {
    setIsLoading(true);
    try {
      const { data } = await axios.get('http://localhost:3000/api/warehouses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWarehouses(data);
      if (!isAdmin && user.assignedWarehouse) {
        setSelectedWarehouse(user.assignedWarehouse.toString());
        fetchProducts(user.assignedWarehouse.toString());
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load warehouses');
      if (error.response?.status === 401) navigate('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async (warehouse) => {
    setIsLoading(true);
    try {
      const { data } = await axios.get(`http://localhost:3000/api/products?warehouse=${warehouse}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(data);
      setSelectedProduct('');
      setLots([]);
      setSelectedLot('');
      setQuantity('');
      setReason('');
      setError('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLots = async (productId) => {
    setIsLoading(true);
    try {
      const { data } = await axios.get(`http://localhost:3000/api/lots?productId=${productId}&warehouse=${selectedWarehouse}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLots(data);
      setSelectedLot('');
      setQuantity('');
      setReason('');
      setError('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load lots');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Please login first');
      return;
    }
    if (!selectedWarehouse || !selectedLot || !quantity || !reason) {
      toast.error('Please select Warehouse and fill all required fields');
      return;
    }
    if (parseInt(quantity) <= 0) {
      toast.error('Quantity must be positive');
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
      if (selectedProduct) fetchLots(selectedProduct); // Refresh lots
      setSelectedProduct('');
      setSelectedLot('');
      setQuantity('');
      setReason('');
      setError('');
    } catch (error) {
      setError(error.response?.data?.message || 'Error marking as damaged');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) return null;

  return (
    <div className="p-6 max-w-screen mx-auto bg-gray-50 rounded-xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Manage Damage</h2>
        <button
          type="submit"
          onClick={handleSubmit}
          className={`inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white ${isLoading ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'}`}
          disabled={isLoading || !selectedWarehouse || !selectedLot || !quantity || !reason}
        >
          {isLoading ? 'Processing...' : 'Mark as Damaged'}
        </button>
      </div>

      {isLoading && !warehouses.length ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse *</label>
                <Select.Root
                  value={selectedWarehouse}
                  onValueChange={(value) => {
                    setSelectedWarehouse(value);
                    fetchProducts(value);
                  }}
                  disabled={isLoading || (!isAdmin && user.assignedWarehouse)}
                  required
                >
                  <Select.Trigger
                    className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-lg appearance-none bg-white hover:bg-gray-100 transition-colors duration-200"
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
                        {visibleWarehouses.map(w => (
                          <Select.Item
                            key={w._id}
                            value={w._id.toString()}
                            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 cursor-pointer focus:bg-red-100 m-2 rounded-sm focus:outline-none"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
                <Select.Root
                  value={selectedProduct}
                  onValueChange={(value) => {
                    setSelectedProduct(value);
                    fetchLots(value);
                  }}
                  disabled={isLoading || !selectedWarehouse}
                  required
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
                        {products.map(product => (
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Lot Code *</label>
                <Select.Root
                  value={selectedLot}
                  onValueChange={setSelectedLot}
                  disabled={isLoading || !selectedProduct}
                  required
                >
                  <Select.Trigger
                    className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-lg appearance-none bg-white hover:bg-gray-100 transition-colors duration-200"
                  >
                    <Select.Value placeholder="Select lot code" />
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
                            <Select.ItemText>{lot.lotCode}</Select.ItemText>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  required
                />
              </div>
            </div>
          </div>
          {error && <p className="text-red-500 mt-2">{error}</p>}
        </form>
      )}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
    </div>
  );
};

export default ManageDamage;