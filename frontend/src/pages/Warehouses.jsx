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

    const handleCreateOrUpdateWarehouse = async (e) => {
      e.preventDefault();
      if (!token) {
        toast.error('Please login first');
        return;
      }
      try {
        if (editingId) {
          const res = await axios.put(`http://localhost:3000/api/warehouses/${editingId}`, {
            warehouseCode,
            name,
            branch,
            assignedUser,
          }, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setWarehouses(warehouses.map(w => w._id === editingId ? res.data.warehouse : w));
          setEditingId(null);
          setWarehouseCode('');
          setName('');
          setBranch('');
          setAssignedUser('');
          setMessage(res.data.message);
          toast.success('Warehouse updated successfully!');
        } else {
          const res = await axios.post('http://localhost:3000/api/warehouses', {
            warehouseCode,
            name,
            branch,
            assignedUser,
          }, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMessage(res.data.message);
          setWarehouses([...warehouses, res.data.warehouse]);
          setWarehouseCode('');
          setName('');
          setBranch('');
          setAssignedUser('');
          toast.success('Warehouse created successfully!');
        }
      } catch (error) {
        setMessage(error.response?.data?.message || 'Error processing warehouse');
        toast.error(error.response?.data?.message || 'Network Error');
      }
    };

    const handleEditWarehouse = (warehouse) => {
      console.log('Editing warehouse:', warehouse);
      setEditingId(warehouse._id);
      setWarehouseCode(warehouse.warehouseCode);
      setName(warehouse.name);
      setBranch(warehouse.branch);
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

    if (!token || userRole !== 'admin') return null;

    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Warehouses</h2>
        <form onSubmit={handleCreateOrUpdateWarehouse} className="space-y-4 mb-4">
          <input
            type="text"
            value={warehouseCode}
            onChange={(e) => setWarehouseCode(e.target.value)}
            placeholder="Warehouse Code"
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Warehouse Name"
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="Branch"
            className="w-full p-2 border rounded"
            required
          />
          <select
            value={assignedUser}
            onChange={(e) => setAssignedUser(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">No User Assigned</option>
            {users.map(user => (
              <option key={user._id} value={user._id}>
                {user.username}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-blue-500 text-white p-2 rounded"
          >
            {editingId ? 'Update Warehouse' : 'Create Warehouse'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setWarehouseCode(''); setName(''); setBranch(''); setAssignedUser(''); }}
              className="bg-gray-500 text-white p-2 rounded ml-2"
            >
              Cancel
            </button>
          )}
          {message && <p className="mt-2">{message}</p>}
        </form>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Warehouse Code</th>
              <th className="border p-2">Warehouse Name</th>
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
                <td className="border p-2">{warehouse.status}</td>
                <td className="border p-2">{warehouse.assignedUser ? warehouse.assignedUser.username : 'None'}</td>
                <td className="border p-2">
                  <button
                    onClick={() => handleEditWarehouse(warehouse)}
                    className="text-blue-500 mr-2"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDeleteWarehouse(warehouse._id)}
                    className="text-red-500"
                    disabled={warehouse.status === 'Active'}
                  >
                    <FaTrash />
                  </button>
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