import { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';

const Warehouses = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [users, setUsers] = useState([]);
  const [warehouseCode, setWarehouseCode] = useState('');
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [status, setStatus] = useState('Active');
  const [assignedUser, setAssignedUser] = useState('');
  const [editingId, setEditingId] = useState(null);
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
      toast.error('Unauthorized access: Only admins can manage warehouses');
      navigate('/');
      return;
    }
    const fetchData = async () => {
      try {
        const [warehousesRes, usersRes] = await Promise.all([
          axios.get('http://localhost:3000/api/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:3000/api/users', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setWarehouses(warehousesRes.data);
        setUsers(usersRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data');
      }
    };
    fetchData();
  }, [token, navigate, userRole]);

  const resetForm = () => {
    setEditingId(null);
    setWarehouseCode('');
    setName('');
    setBranch('');
    setStatus('Active');
    setAssignedUser('');
  };

  const handleCreateOrUpdateWarehouse = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Please login first');
      return;
    }
    try {
      const payload = {
        warehouseCode,
        name,
        branch,
        status,
        assignedUser,
      };

      if (editingId) {
        const res = await axios.put(`http://localhost:3000/api/warehouses/${editingId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setWarehouses(warehouses.map(w => w._id === editingId ? res.data.warehouse : w));
        toast.success(res.data.message);
      } else {
        const res = await axios.post('http://localhost:3000/api/warehouses', payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setWarehouses([...warehouses, res.data.warehouse]);
        toast.success(res.data.message);
      }
      resetForm();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Error processing warehouse');
      toast.error(error.response?.data?.message || 'Network Error');
    }
  };

  const handleEditWarehouse = (warehouse) => {
    setEditingId(warehouse._id);
    setWarehouseCode(warehouse.warehouseCode);
    setName(warehouse.name);
    setBranch(warehouse.branch);
    setStatus(warehouse.status || 'Active');
    setAssignedUser(warehouse.assignedUser ? warehouse.assignedUser._id : '');
  };

  const handleDeleteWarehouse = async (id) => {
    if (!token) {
      toast.error('Please login first');
      return;
    }
    if (window.confirm('Are you sure you want to delete this warehouse?')) {
      try {
        const res = await axios.delete(`http://localhost:3000/api/warehouses/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setWarehouses(warehouses.filter(w => w._id !== id));
        toast.success(res.data.message);
      } catch (error) {
        setMessage(error.response?.data?.message || 'Error deleting warehouse');
        toast.error(error.response?.data?.message || 'Network Error');
      }
    }
  };

  const handleToggleStatus = async (warehouse) => {
    const newStatus = warehouse.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await axios.put(`http://localhost:3000/api/warehouses/${warehouse._id}`, {
        warehouseCode: warehouse.warehouseCode,
        name: warehouse.name,
        branch: warehouse.branch,
        status: newStatus,
        assignedUser: warehouse.assignedUser?._id || '',
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWarehouses(warehouses.map(w => w._id === warehouse._id ? res.data.warehouse : w));
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Failed to update status');
    }
  };

  if (!token || userRole !== 'admin') return null;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Warehouse Management</h2>
      <form onSubmit={handleCreateOrUpdateWarehouse} className="space-y-4 mb-6">
        <input type="text" value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value)} placeholder="Warehouse Code" className="w-full p-2 border rounded" required />
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Warehouse Name" className="w-full p-2 border rounded" required />
        <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Branch" className="w-full p-2 border rounded" required />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full p-2 border rounded">
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <select value={assignedUser} onChange={(e) => setAssignedUser(e.target.value)} className="w-full p-2 border rounded">
          <option value="">No User Assigned</option>
          {users.map(user => (
            <option key={user._id} value={user._id}>{user.username}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="submit" className="bg-blue-500 text-white p-2 rounded">
            {editingId ? 'Update Warehouse' : 'Create Warehouse'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="bg-gray-500 text-white p-2 rounded">Cancel</button>
          )}
        </div>
        {message && <p className="text-red-500">{message}</p>}
      </form>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Code</th>
            <th className="border p-2">Name</th>
            <th className="border p-2">Branch</th>
            <th className="border p-2">Status</th>
            <th className="border p-2">Assigned User</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {warehouses.map((warehouse) => (
            <tr key={warehouse._id} className="border">
              <td className="border p-2">{warehouse.warehouseCode}</td>
              <td className="border p-2">{warehouse.name}</td>
              <td className="border p-2">{warehouse.branch}</td>
              <td className="border p-2 text-center">
                <button
                  onClick={() => handleToggleStatus(warehouse)}
                  className={`px-3 py-0.5 rounded-full text-white font-semibold ${warehouse.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}
                >
                  {warehouse.status}
                </button>
              </td>
              <td className="border p-2">{warehouse.assignedUser ? warehouse.assignedUser.username : 'None'}</td>
              <td className="border p-2">
                <button onClick={() => handleEditWarehouse(warehouse)} className="text-blue-500 mr-2"><FaEdit /></button>
                <button onClick={() => handleDeleteWarehouse(warehouse._id)} className="text-red-500" disabled={warehouse.status === 'Active'}><FaTrash /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ToastContainer />
    </div>
  );
};

export default Warehouses;