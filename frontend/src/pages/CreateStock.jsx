import { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';

const CreateStock = () => {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [lotCode, setLotCode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expDate, setExpDate] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const userRole = token ? JSON.parse(atob(token.split('.')[1])).role : '';

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
      if (userRole !== 'admin') {
        toast.error('Unauthorized access: Only admins can create stock');
        navigate('/');
        return;
      }
    } catch {
      localStorage.removeItem('token');
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [productsRes, warehousesRes] = await Promise.all([
          axios.get('http://localhost:3000/api/products', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:3000/api/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setProducts(productsRes.data);
        setWarehouses(warehousesRes.data);
        if (productsRes.data.length > 0) setSelectedProduct(productsRes.data[0]._id);
        if (warehousesRes.data.length > 0) setWarehouse(warehousesRes.data[0].name);
      } catch (error) {
        if (error.response?.status === 401) {
          toast.error('Session expired, please login again');
          navigate('/login');
        } else {
          toast.error('Failed to load data');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [token, navigate, userRole]);

  const handleCreateStock = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Please login first');
      return;
    }
    if (!selectedProduct || !lotCode || !quantity || !expDate || !warehouse) {
      toast.error('Please fill all required fields');
      return;
    }
    if (quantity <= 0) {
      toast.error('Quantity must be positive');
      return;
    }
    setIsLoading(true);
    try {
      const res = await axios.post('http://localhost:3000/api/lots', {
        lotCode,
        productId: selectedProduct,
        expDate,
        qtyOnHand: Number(quantity),
        warehouse,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(res.data.message);
      setIsModalOpen(false);
      setLotCode('');
      setQuantity('');
      setExpDate('');
      setSelectedProduct(products[0]?._id || '');
      setWarehouse(warehouses[0]?.name || '');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Network Error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Create Stock</h2>
      <button
        onClick={() => setIsModalOpen(true)}
        className="mb-4 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
      >
        Add New Stock
      </button>
      {isLoading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div>
          {isModalOpen && (
            <div className="fixed inset-0 bg-[rgb(0,0,0)]/50 flex justify-center items-center">
              <div className="bg-white p-6 rounded-lg w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">Create Stock</h3>
                <form onSubmit={handleCreateStock} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Product</label>
                    <select
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={isLoading}
                    >
                      <option value="">Select Product</option>
                      {products.map((product) => (
                        <option key={product._id} value={product._id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Lot Code</label>
                    <input
                      type="text"
                      value={lotCode}
                      onChange={(e) => setLotCode(e.target.value)}
                      placeholder="Lot Code"
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quantity</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Quantity"
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                      required
                      min="1"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Expiration Date</label>
                    <input
                      type="date"
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Warehouse</label>
                    <select
                      value={warehouse}
                      onChange={(e) => setWarehouse(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={isLoading}
                    >
                      <option value="">Select Warehouse</option>
                      {warehouses.map((wh) => (
                        <option key={wh._id} value={wh.name}>{wh.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className={`w-full py-2 px-4 rounded text-white ${isLoading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Creating...' : 'Create Stock'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="w-full py-2 px-4 rounded bg-gray-500 text-white hover:bg-gray-600"
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default CreateStock;