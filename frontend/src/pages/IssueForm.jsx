import { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';

const IssueForm = () => {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [issueType, setIssueType] = useState('normal');
  const [lotId, setLotId] = useState('');
  const [lots, setLots] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const userWarehouse = token ? JSON.parse(atob(token.split('.')[1])).warehouse : '';

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

    const fetchData = async () => {
      setIsLoading(true);
      try {
        console.log('Fetching data for IssueForm, token:', token); // Debug
        const [productsRes, lotsRes, warehousesRes] = await Promise.all([
          axios.get('http://localhost:3000/api/products', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:3000/api/lots', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:3000/api/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        console.log('Products:', productsRes.data); // Debug
        console.log('Lots:', lotsRes.data); // Debug
        console.log('Warehouses:', warehousesRes.data); // Debug
        setProducts(productsRes.data);
        setLots(lotsRes.data);
        setWarehouses(warehousesRes.data);
        if (productsRes.data.length > 0) setSelectedProduct(productsRes.data[0]._id);
        if (userWarehouse !== 'All' && warehousesRes.data.length > 0) {
          setWarehouse(userWarehouse);
        } else if (warehousesRes.data.length > 0) {
          setWarehouse(warehousesRes.data[0].name);
        }
      } catch (error) {
        console.error('Error fetching data:', error.response || error); // Debug
        if (error.response?.status === 401) {
          toast.error('Session expired, please login again');
          navigate('/login');
        } else if (error.response?.status === 404) {
          toast.error('API endpoint not found. Please check backend configuration.');
        } else {
          toast.error('Failed to load data');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [token, navigate, userWarehouse]);

  useEffect(() => {
    const filteredLots = userWarehouse === 'All'
      ? lots.filter(lot => lot.qtyOnHand > 0 && lot.productId.toString() === selectedProduct)
      : lots.filter(lot => lot.warehouse === warehouse && lot.qtyOnHand > 0 && lot.productId.toString() === selectedProduct);
    console.log('Filtered lots:', filteredLots); // Debug
    if (filteredLots.length === 0 && issueType === 'waste') {
      setLotId('');
      toast.warn('No available lots for this product and warehouse');
    } else if (issueType === 'waste' && filteredLots.length > 0) {
      const defaultLotId = filteredLots.find(lot => lot._id === lotId) ? lotId : filteredLots[0]._id;
      setLotId(defaultLotId);
      console.log('Set lotId:', defaultLotId); // Debug
    }
  }, [userWarehouse, lots, warehouse, issueType, lotId, selectedProduct]);

  const handleIssue = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Please login first');
      return;
    }
    if (!selectedProduct || !warehouse || !issueType || !quantity || quantity <= 0) {
      toast.error('Please fill all required fields and ensure quantity is positive');
      return;
    }
    if (issueType === 'waste' && !lotId) {
      toast.error('Lot ID is required for waste issue');
      return;
    }
    const selectedLot = lots.find(lot => lot._id === lotId);
    if (issueType === 'waste' && selectedLot && quantity > selectedLot.qtyOnHand) {
      toast.error(`Quantity cannot exceed available stock (${selectedLot.qtyOnHand})`);
      return;
    }
    setIsLoading(true);
    try {
      console.log('Issuing stock:', { productId: selectedProduct, quantity, warehouse, issueType, lotId }); // Debug
      const res = await axios.post('http://localhost:3000/api/issue', {
        productId: selectedProduct,
        quantity: Number(quantity),
        warehouse,
        issueType,
        lotId: issueType === 'waste' ? lotId : undefined,
      }, { headers: { Authorization: `Bearer ${token}` } });
      const lotsRes = await axios.get('http://localhost:3000/api/lots', { headers: { Authorization: `Bearer ${token}` } });
      console.log('Updated lots:', lotsRes.data); // Debug
      setLots(lotsRes.data);
      toast.success(res.data.message);
      setQuantity('');
      setLotId('');
    } catch (error) {
      console.error('Error issuing stock:', error.response || error); // Debug
      if (error.response?.status === 404) {
        toast.error('API endpoint not found. Please check backend configuration.');
      } else {
        toast.error(error.response?.data?.message || 'Network Error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-screen mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Issue Stock</h2>
      {isLoading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <form onSubmit={handleIssue} className="space-y-4 max-w-md">
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
            <label className="block text-sm font-medium text-gray-700">Warehouse</label>
            <select
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={userWarehouse !== 'All' || isLoading}
            >
              <option value="">Select Warehouse</option>
              {warehouses.map((wh) => (
                <option key={wh._id} value={wh.name}>{wh.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Issue Type</label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isLoading}
            >
              <option value="normal">Normal</option>
              <option value="expired">Expired</option>
              <option value="waste">Waste</option>
            </select>
          </div>
          {issueType === 'waste' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Lot</label>
              <select
                value={lotId}
                onChange={(e) => setLotId(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={isLoading}
              >
                <option value="">Select Lot</option>
                {lots.filter(lot => lot.qtyOnHand > 0 && lot.productId.toString() === selectedProduct && (userWarehouse === 'All' || lot.warehouse === warehouse)).map((lot) => (
                  <option key={lot._id} value={lot._id}>
                    {lot.lotCode} (Qty: {lot.qtyOnHand})
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="submit"
            className={`w-full py-2 px-4 rounded text-white ${isLoading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
            disabled={isLoading}
          >
            {isLoading ? 'Issuing...' : 'Issue Stock'}
          </button>
        </form>
      )}
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default IssueForm;