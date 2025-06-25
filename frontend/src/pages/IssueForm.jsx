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
    const [issueType, setIssueType] = useState('forSale');
    const [lotId, setLotId] = useState('');
    const [lots, setLots] = useState([]);
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
        if (res.data.length > 0) setSelectedProduct(res.data[0]._id);
      };
      const fetchLots = async () => {
        try {
          const res = await axios.get('http://localhost:3000/api/lots', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setLots(res.data);
          console.log('Fetched lots:', res.data); // Debug
        } catch (error) {
          console.error('Error fetching lots:', error);
          toast.error('Failed to load lots');
        }
      };
      fetchProducts();
      fetchLots();
    }, [token, navigate, userWarehouse]);

    useEffect(() => {
      if (userWarehouse) {
        setWarehouse(userWarehouse);
      }
      const filteredLots = userWarehouse === 'All' 
        ? lots.filter(lot => lot.qtyOnHand > 0) 
        : lots.filter(lot => lot.warehouse === warehouse && lot.qtyOnHand > 0);
      console.log('Current warehouse:', warehouse); // Debug
      console.log('Filtered lots:', filteredLots); // Debug
      if (filteredLots.length === 0 && issueType === 'waste') {
        setLotId(''); // Reset lotId if no lots available
        toast.warn('No available lots for this warehouse');
      } else if (issueType === 'waste' && filteredLots.length > 0) {
        const defaultLotId = filteredLots.find(lot => lot._id === lotId) ? lotId : filteredLots[0]._id;
        setLotId(defaultLotId); // Set or keep existing lotId
        console.log('Set lotId:', defaultLotId); // Debug
      }
    }, [userWarehouse, lots, warehouse, issueType, lotId]);

    const handleIssue = async (e) => {
      e.preventDefault();
      if (!token) {
        toast.error('Please login first');
        return;
      }
      if (!selectedProduct || !warehouse || !issueType || quantity <= 0) {
        toast.error('Please fill all fields and ensure quantity is positive');
        return;
      }
      if (issueType === 'waste' && !lotId) {
        toast.error('Lot ID is required for waste issue');
        return;
      }
      try {
        console.log('Sending issue request:', { productId: selectedProduct, quantity, warehouse, issueType, lotId }); // Debug
        const res = await axios.post('http://localhost:3000/api/issue', {
          productId: selectedProduct,
          quantity,
          warehouse,
          issueType,
          lotId: issueType === 'waste' ? lotId : null,
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
            min="1"
          />
          <select
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
            className="w-full p-2 border rounded"
            disabled={userWarehouse !== 'All'}
          >
            {userWarehouse === 'All' ? (
              <>
                <option value="Bangkok Main Warehouse">Bangkok Main Warehouse</option>
                <option value="Silom Sub Warehouse">Silom Sub Warehouse</option>
                <option value="Chiang Mai Warehouse">Chiang Mai Warehouse</option>
                <option value="Phnom Penh Warehouse">Phnom Penh Warehouse</option>
              </>
            ) : (
              <option value={userWarehouse}>{userWarehouse}</option>
            )}
          </select>
          <select
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="forSale">For Sale</option>
            <option value="welfare">Welfare</option>
            <option value="expired">Expired</option>
            <option value="waste">Waste</option>
          </select>
          {issueType === 'waste' && (
            <select
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">Select Lot</option>
              {lots.length > 0 ? (
                (userWarehouse === 'All' 
                  ? lots.filter(lot => lot.qtyOnHand > 0) 
                  : lots.filter(lot => lot.warehouse === warehouse && lot.qtyOnHand > 0)
                ).map((lot) => (
                  <option key={lot._id} value={lot._id}>
                    {lot.lotCode} (Qty: {lot.qtyOnHand})
                  </option>
                ))
              ) : (
                <option value="" disabled>No lots available</option>
              )}
            </select>
          )}
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