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
  const [isLoading, setIsLoading] = useState(false);
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
        toast.error('Unauthorized access: Only admins can manage users');
        navigate('/');
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
        console.log('Fetching users and warehouses, token:', token);
        const [usersRes, warehousesRes] = await Promise.all([
          axios.get('http://localhost:3000/api/users', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:3000/api/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        console.log('Users:', usersRes.data);
        console.log('Warehouses:', warehousesRes.data);
        setUsers(usersRes.data);
        setWarehouses(warehousesRes.data);
        if (warehousesRes.data.length === 0) {
          toast.warn('No warehouses available. Please create a warehouse first.');
        }
      } catch (error) {
        console.error('Error fetching data:', error.response || error);
        if (error.response?.status === 401) {
          toast.error('Session expired, please login again');
          navigate('/login');
        } else {
          toast.error(error.response?.data?.message || 'Failed to load data');
        }
      } finally {
        setIsLoading(false);
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
    if (!token) {
      toast.error('Please login first');
      return;
    }
    if (!username || (!editingId && !password) || !role) {
      toast.error('Please fill all required fields');
      return;
    }
    if (password && password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setIsLoading(true);
    try {
      const payload = { username, password: password || undefined, role, assignedWarehouse: assignedWarehouse || undefined };
      console.log('Sending user payload:', payload);
      if (editingId) {
        const response = await axios.put(`http://localhost:3000/api/users/${editingId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Update user response:', response.data);
        setUsers(users.map(u => u._id === editingId ? response.data.user : u));
        toast.success(response.data.message);
      } else {
        const response = await axios.post('http://localhost:3000/api/users', payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Create user response:', response.data);
        setUsers([...users, response.data.user]);
        toast.success(response.data.message);
      }
      resetForm();
    } catch (error) {
      console.error('Error creating/updating user:', error.response || error);
      toast.error(error.response?.data?.message || 'Network Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditUser = (user) => {
    console.log('Editing user:', user);
    setEditingId(user._id);
    setUsername(user.username);
    setRole(user.role);
    setAssignedWarehouse(user.assignedWarehouse?._id || '');
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (id) => {
    if (!token) {
      toast.error('Please login first');
      return;
    }
    if (window.confirm('Are you sure you want to delete this user?')) {
      setIsLoading(true);
      try {
        console.log('Deleting user:', id);
        await axios.delete(`http://localhost:3000/api/users/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        setUsers(users.filter(u => u._id !== id));
        toast.success('User deleted successfully');
      } catch (error) {
        console.error('Error deleting user:', error.response || error);
        toast.error(error.response?.data?.message || 'Network Error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!token || userRole !== 'admin') return null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Users Management</h2>
      <button
        onClick={() => setIsModalOpen(true)}
        className="mb-6 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        disabled={warehouses.length === 0}
      >
        Create User
      </button>
      {isLoading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div>
          {isModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
              <div className="bg-white p-6 rounded-lg w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">{editingId ? 'Edit User' : 'Create User'}</h3>
                <form onSubmit={handleCreateOrUpdateUser} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Password {editingId ? '(Optional)' : ''}</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                      required={!editingId}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={isLoading}
                    >
                      <option value="admin">Admin</option>
                      <option value="user">User</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Warehouse</label>
                    <select
                      value={assignedWarehouse}
                      onChange={(e) => setAssignedWarehouse(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isLoading || warehouses.length === 0}
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
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className={`w-full py-2 px-4 rounded text-white ${isLoading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Processing...' : (editingId ? 'Update User' : 'Create User')}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
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
          <table className="w-full border-collapse bg-white shadow rounded-lg">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-3 text-left text-sm font-semibold text-gray-600">Username</th>
                <th className="border p-3 text-left text-sm font-semibold text-gray-600">Role</th>
                <th className="border p-3 text-left text-sm font-semibold text-gray-600">Assigned Warehouse</th>
                <th className="border p-3 text-right text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-b hover:bg-gray-50">
                  <td className="border p-3">{user.username}</td>
                  <td className="border p-3">{user.role}</td>
                  <td className="border p-3">{user.assignedWarehouse ? user.assignedWarehouse.name : 'None'}</td>
                  <td className="border p-3 text-right">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="text-blue-500 hover:text-blue-700 mr-3"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user._id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Users;