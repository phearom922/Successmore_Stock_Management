import { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';

const ManageStockStatus = () => {
  const [lots, setLots] = useState([]);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [status, setStatus] = useState('active');
  const [quantity, setQuantity] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      navigate('/login');
      return;
    }

    const fetchLots = async () => {
      setIsLoading(true);
      try {
        const res = await axios.get('http://localhost:3000/api/lots', { headers: { Authorization: `Bearer ${token}` } });
        const filteredLots = userWarehouse === 'All' ? res.data : res.data.filter(lot => lot.warehouse === userWarehouse);
        setLots(filteredLots);
        if (filteredLots.length > 0) setSelectedLotId(filteredLots[0]._id);
      } catch (error) {
        if (error.response?.status === 401) {
          toast.error('Session expired, please login again');
          navigate('/login');
        } else {
          toast.error('Failed to load lots');
        }
      } finally {
        setIsLoading(false);
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
    if (!selectedLotId || !status) {
      toast.error('Please select a lot and status');
      return;
    }
    if (quantity && Number(quantity) <= 0) {
      toast.error('Quantity must be positive');
      return;
    }
    const selectedLot = lots.find(lot => lot._id === selectedLotId);
    if (quantity && Number(quantity) > selectedLot.qtyOnHand) {
      toast.error(`Quantity cannot exceed available stock (${selectedLot.qtyOnHand})`);
      return;
    }
    setIsLoading(true);
    try {
      if (quantity) {
        const res = await axios.post('http://localhost:3000/api/lots/split-status', {
          lotId: selectedLotId,
          status,
          quantity: Number(quantity),
        }, { headers: { Authorization: `Bearer ${token}` } });
        toast.success(res.data.message);
      } else {
        const res = await axios.post('http://localhost:3000/api/lots/status', {
          lotId: selectedLotId,
          status,
        }, { headers: { Authorization: `Bearer ${token}` } });
        toast.success(res.data.message);
      }
      const updatedLots = await axios.get('http://localhost:3000/api/lots', { headers: { Authorization: `Bearer ${token}` } });
      setLots(userWarehouse === 'All' ? updatedLots.data : updatedLots.data.filter(lot => lot.warehouse === userWarehouse));
      setIsModalOpen(false);
      setQuantity('');
      setStatus('active');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Network Error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Manage Stock Status</h2>
      <button
        onClick={() => setIsModalOpen(true)}
        className="mb-4 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
      >
        Update Lot Status
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
                <h3 className="text-lg font-bold mb-4">Update Lot Status</h3>
                <form onSubmit={handleUpdateStatus} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Lot</label>
                    <select
                      value={selectedLotId}
                      onChange={(e) => setSelectedLotId(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={isLoading}
                    >
                      <option value="">Select Lot</option>
                      {lots.map((lot) => (
                        <option key={lot._id} value={lot._id}>
                          {lot.lotCode} (Qty: {lot.qtyOnHand}, Status: {lot.status})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={isLoading}
                    >
                      <option value="active">Active</option>
                      <option value="damaged">Damaged</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quantity (Optional)</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Quantity to change status"
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className={`w-full py-2 px-4 rounded text-white ${isLoading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Updating...' : 'Update Status'}
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

export default ManageStockStatus;