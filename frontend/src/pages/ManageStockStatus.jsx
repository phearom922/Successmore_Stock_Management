import { useState, useEffect } from 'react';
  import axios from 'axios';
  import { ToastContainer, toast } from 'react-toastify';
  import 'react-toastify/dist/ReactToastify.css';
  import { useNavigate } from 'react-router-dom';

  const ManageStockStatus = () => {
    const [lots, setLots] = useState([]);
    const [selectedLotId, setSelectedLotId] = useState('');
    const [status, setStatus] = useState('active');
    const [quantity, setQuantity] = useState(0);
    const [message, setMessage] = useState('');
    const token = localStorage.getItem('token');
    const navigate = useNavigate();
    const userWarehouse = token ? JSON.parse(atob(token.split('.')[1])).warehouse : '';

    useEffect(() => {
      if (!token) {
        navigate('/login');
        return;
      }
      const fetchLots = async () => {
        try {
          const res = await axios.get('http://localhost:3000/api/lots', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const filteredLots = userWarehouse === 'All' ? res.data : res.data.filter(lot => lot.warehouse === userWarehouse);
          setLots(filteredLots);
          if (filteredLots.length > 0) setSelectedLotId(filteredLots[0]._id);
        } catch (error) {
          console.error('Error fetching lots:', error);
          toast.error('Failed to load lots');
        }
      };
      fetchLots();
    }, [token, navigate, userWarehouse]);

    const handleUpdateStatus = async (e) => {
      e.preventDefault();
      if (!token) {
        toast.error('Please login first');
        return;
      }
      try {
        if (quantity > 0) {
          // Split status with quantity
          const res = await axios.post('http://localhost:3000/api/lots/split-status', {
            lotId: selectedLotId,
            status,
            quantity,
          }, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMessage(res.data.message);
          toast.success('Lot split and status updated successfully!');
        } else {
          // Update status for entire lot
          const res = await axios.post('http://localhost:3000/api/lots/status', {
            lotId: selectedLotId,
            status,
          }, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMessage(res.data.message);
          toast.success('Lot status updated successfully!');
        }
        // รีเฟรชข้อมูลหลังอัปเดต
        const updatedLots = await axios.get('http://localhost:3000/api/lots', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLots(updatedLots.data);
      } catch (error) {
        setMessage(error.response?.data?.message || 'Error updating status');
        toast.error(error.response?.data?.message || 'Network Error');
      }
    };

    if (!token) return null;

    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Manage Stock Status</h2>
        <form onSubmit={handleUpdateStatus} className="space-y-4">
          <select
            value={selectedLotId}
            onChange={(e) => setSelectedLotId(e.target.value)}
            className="w-full p-2 border rounded"
            required
          >
            <option value="">Select Lot</option>
            {lots.map((lot) => (
              <option key={lot._id} value={lot._id}>
                {lot.lotCode} (Qty: {lot.qtyOnHand}, Status: {lot.status})
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="active">Active</option>
            <option value="damaged">Damaged</option>
            <option value="expired">Expired</option>
          </select>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            placeholder="Quantity to change status (optional)"
            className="w-full p-2 border rounded"
            min="0"
          />
          <button type="submit" className="bg-blue-500 text-white p-2 rounded">
            Update Status
          </button>
          {message && <p className="mt-2">{message}</p>}
        </form>
        <ToastContainer />
      </div>
    );
  };

  export default ManageStockStatus;