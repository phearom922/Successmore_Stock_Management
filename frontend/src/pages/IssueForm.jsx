import { useState, useEffect } from 'react';
  import axios from 'axios';
  import { ToastContainer, toast } from 'react-toastify';
  import 'react-toastify/dist/ReactToastify.css';
  import { useNavigate } from 'react-router-dom';

  const IssueForm = () => {
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState(0);
    const [warehouse, setWarehouse] = useState('');
    const [message, setMessage] = useState('');
    const token = localStorage.getItem('token');
    const navigate = useNavigate();
    const userWarehouse = token ? JSON.parse(atob(token.split('.')[1])).warehouse : '';

    useEffect(() => {
      if (!token) {
        navigate('/login');
        return;
      }
      const fetchProducts = async () => {
        const res = await axios.get('http://localhost:3000/api/products', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProducts(res.data);
        // Set default warehouse from token
        if (userWarehouse) setWarehouse(userWarehouse);
      };
      fetchProducts();
    }, [token, navigate, userWarehouse]);

    const handleIssue = async (e) => {
      e.preventDefault();
      if (!token) {
        toast.error('Please login first');
        return;
      }
      try {
        const res = await axios.post('http://localhost:3000/api/issue', {
          productId: selectedProduct,
          quantity,
          warehouse,
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessage(res.data.message);
        const lotsRes = await axios.get('http://localhost:3000/api/lots', {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Updated Lots:', lotsRes.data);
        toast.success('Stock issued successfully!');
      } catch (error) {
        setMessage(error.response?.data?.message || 'Error issuing stock');
        toast.error(error.response?.data?.message || 'Network Error');
      }
    };

    if (!token) return null;

    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Issue Stock</h2>
        <form onSubmit={handleIssue} className="space-y-4">
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
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            placeholder="Quantity"
            className="w-full p-2 border rounded"
            required
          />
          <select
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
            className="w-full p-2 border rounded"
            disabled={userWarehouse !== 'All'} // Disable if not Admin
          >
            {userWarehouse === 'All' ? (
              <>
                <option value="Bangkok Main Warehouse">Bangkok Main Warehouse</option>
                <option value="Silom Sub Warehouse">Silom Sub Warehouse</option>
              </>
            ) : (
              <option value={userWarehouse}>{userWarehouse}</option>
            )}
          </select>
          <button type="submit" className="bg-blue-500 text-white p-2 rounded">
            Issue Stock
          </button>
          {message && <p className="mt-2">{message}</p>}
        </form>
        <ToastContainer />
      </div>
    );
  };

  export default IssueForm;