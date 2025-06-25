import { useState, useEffect } from 'react';
  import axios from 'axios';
  import { ToastContainer, toast } from 'react-toastify';
  import 'react-toastify/dist/ReactToastify.css';
  import { useNavigate } from 'react-router-dom';

  const CreateStock = () => {
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [lotCode, setLotCode] = useState('');
    const [quantity, setQuantity] = useState(0);
    const [expDate, setExpDate] = useState('');
    const [warehouse, setWarehouse] = useState('');
    const [message, setMessage] = useState('');
    const token = localStorage.getItem('token');
    const navigate = useNavigate();
    const userRole = token ? JSON.parse(atob(token.split('.')[1])).role : '';

    useEffect(() => {
      if (!token) {
        navigate('/login');
        return;
      }
      if (userRole !== 'admin') {
        toast.error('Unauthorized access: Only admins can create stock');
        navigate('/');
        return;
      }
      const fetchProducts = async () => {
        try {
          const res = await axios.get('http://localhost:3000/api/products', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setProducts(res.data);
          if (res.data.length > 0) setSelectedProduct(res.data[0]._id);
        } catch (error) {
          console.error('Error fetching products:', error);
          toast.error('Failed to load products');
        }
      };
      fetchProducts();
    }, [token, navigate, userRole]);

    const handleCreateStock = async (e) => {
      e.preventDefault();
      if (!token) {
        toast.error('Please login first');
        return;
      }
      try {
        const res = await axios.post('http://localhost:3000/api/lots', {
          lotCode,
          productId: selectedProduct,
          expDate,
          qtyOnHand: quantity,
          warehouse,
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessage(res.data.message);
        toast.success('Stock created successfully!');
      } catch (error) {
        setMessage(error.response?.data?.message || 'Error creating stock');
        toast.error(error.response?.data?.message || 'Network Error');
      }
    };

    if (!token || userRole !== 'admin') return null;

    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Create Stock</h2>
        <form onSubmit={handleCreateStock} className="space-y-4">
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="w-full p-2 border rounded"
            required
          >
            <option value="">Select Product</option>
            {products.map((product) => (
              <option key={product._id} value={product._id}>
                {product.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={lotCode}
            onChange={(e) => setLotCode(e.target.value)}
            placeholder="Lot Code"
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            placeholder="Quantity"
            className="w-full p-2 border rounded"
            required
            min="1"
          />
          <input
            type="date"
            value={expDate}
            onChange={(e) => setExpDate(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
          <select
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
            className="w-full p-2 border rounded"
            required
          >
            <option value="">Select Warehouse</option>
            <option value="Bangkok Main Warehouse">Bangkok Main Warehouse</option>
            <option value="Silom Sub Warehouse">Silom Sub Warehouse</option>
          </select>
          <button type="submit" className="bg-blue-500 text-white p-2 rounded">
            Create Stock
          </button>
          {message && <p className="mt-2">{message}</p>}
        </form>
        <ToastContainer />
      </div>
    );
  };

  export default CreateStock;