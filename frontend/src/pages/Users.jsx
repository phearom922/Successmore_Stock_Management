import { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [assignedWarehouse, setAssignedWarehouse] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const userRole = token ? JSON.parse(atob(token.split('.')[1])).role : '';

  useEffect(() => {
    if (!token || userRole !== 'admin') {
      navigate('/');
      return;
    }
    const fetchData = async () => {
      try {
        const [usersRes, warehousesRes] = await Promise.all([
          axios.get('http://localhost:3000/api/users', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:3000/api/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setUsers(usersRes.data);
        setWarehouses(warehousesRes.data);
      } catch (error) {
        toast.error('Failed to load data');
      }
    };
    fetchData();
  }, [token, navigate, userRole]);

  const resetForm = () => {
    setEditingId(null);
    setUsername('');
    setPassword('');
    setRole('user');
    setAssignedWarehouse('');
    setIsModalOpen(false);
  };

  const handleCreateOrUpdateUser = async (e) => {
    e.preventDefault();
    if (!token) return;
    try {
      const payload = { username, password, role, assignedWarehouse };
      if (editingId) {
        const response = await axios.put(`http://localhost:3000/api/users/${editingId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(users.map(u => u._id === editingId ? response.data.user : u));
        toast.success('User updated successfully');
      } else {
        const response = await axios.post('http://localhost:3000/api/users', payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers([...users, response.data.user]);
        toast.success('User created successfully');
      }
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Network Error');
    }
  };

  const handleEditUser = (user) => {
    setEditingId(user._id);
    setUsername(user.username);
    setRole(user.role);
    setAssignedWarehouse(user.assignedWarehouse?._id || '');
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (id) => {
    if (!token) return;
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await axios.delete(`http://localhost:3000/api/users/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        setUsers(users.filter(u => u._id !== id));
        toast.success('User deleted successfully');
      } catch (error) {
        toast.error(error.response?.data?.message || 'Network Error');
      }
    }
  };

  if (!token || userRole !== 'admin') return null;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Users Management</h2>
      <button
        onClick={() => setIsModalOpen(true)}
        className="bg-blue-500 text-white p-2 rounded mb-4"
      >
        Create User
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">{editingId ? 'Edit User' : 'Create User'}</h3>
            <form onSubmit={handleCreateOrUpdateUser} className="space-y-4">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full p-2 border rounded"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full p-2 border rounded"
                required={!editingId}
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
              <select
                value={assignedWarehouse}
                onChange={(e) => setAssignedWarehouse(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">No Warehouse Assigned</option>
                {warehouses.map(warehouse => (
                  <option
                    key={warehouse._id}
                    value={warehouse._id}
                    disabled={warehouse.assignedUser && warehouse.assignedUser._id !== editingId}
                  >
                    {warehouse.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button type="submit" className="bg-blue-500 text-white p-2 rounded">
                  {editingId ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-500 text-white p-2 rounded"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Username</th>
            <th className="border p-2">Role</th>
            <th className="border p-2">Assigned Warehouse</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user._id} className="border">
              <td className="border p-2">{user.username}</td>
              <td className="border p-2">{user.role}</td>
              <td className="border p-2">{user.assignedWarehouse ? user.assignedWarehouse.name : 'None'}</td>
              <td className="border p-2">
                <button
                  onClick={() => handleEditUser(user)}
                  className="text-blue-500 mr-2"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => handleDeleteUser(user._id)}
                  className="text-red-500"
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

export default Users;