import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash, FaSearch, FaPlus, FaEye } from 'react-icons/fa';
import Modal from 'react-modal';

Modal.setAppElement('#root');

const Users = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [username, setUsername] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [assignedWarehouse, setAssignedWarehouse] = useState('');
  const [permissions, setPermissions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewPermissionsId, setViewPermissionsId] = useState(null);
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
        const [usersRes, warehousesRes] = await Promise.all([
          axios.get('http://localhost:3000/api/users', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:3000/api/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setUsers(usersRes.data);
        setFilteredUsers(usersRes.data);
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

  useEffect(() => {
    const results = users.filter(user =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.assignedWarehouse && user.assignedWarehouse.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredUsers(results);
  }, [searchTerm, users]);

  const resetForm = () => {
    setEditingId(null);
    setUsername('');
    setLastName('');
    setPassword('');
    setRole('user');
    setAssignedWarehouse('');
    setPermissions([]);
    setIsModalOpen(false);
  };

  const handleCreateOrUpdateUser = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Please login first');
      return;
    }
    if (!username || !lastName || (!editingId && !password) || !role || !assignedWarehouse) {
      toast.error('Please fill all required fields');
      return;
    }
    if (password && password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setIsLoading(true);
    try {
      const payload = {
        username,
        lastName,
        password: password || undefined,
        role,
        assignedWarehouse,
        permissions,
      };

      if (editingId) {
        const response = await axios.put(`http://localhost:3000/api/users/${editingId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(users.map(u => u._id === editingId ? response.data.user : u));
        setFilteredUsers(filteredUsers.map(u => u._id === editingId ? response.data.user : u));
        toast.success(response.data.message);
      } else {
        const response = await axios.post('http://localhost:3000/api/users', payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers([...users, response.data.user]);
        setFilteredUsers([...filteredUsers, response.data.user]);
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
    setEditingId(user._id);
    setUsername(user.username);
    setLastName(user.lastName);
    setRole(user.role);
    setAssignedWarehouse(user.assignedWarehouse || '');
    setPermissions(user.permissions || []);
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
        await axios.delete(`http://localhost:3000/api/users/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        setUsers(users.filter(u => u._id !== id));
        setFilteredUsers(filteredUsers.filter(u => u._id !== id));
        toast.success('User deleted successfully');
      } catch (error) {
        console.error('Error deleting user:', error.response || error);
        toast.error(error.response?.data?.message || 'Network Error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleViewPermissions = (userId) => {
    const user = users.find(u => u._id === userId);
    setViewPermissionsId(userId);
    const userPermissions = user.permissions.length > 0 ? user.permissions : [
      { feature: 'lotManagement', permissions: [] },
      { feature: 'manageDamage', permissions: [] },
      { feature: 'category', permissions: [] },
      { feature: 'products', permissions: [] },
    ];
    setPermissions(userPermissions);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (userId) => {
    const user = users.find(u => u._id === userId);
    const newActive = !user.isActive;
    try {
      const payload = {
        isActive: newActive,
        username: user.username,
        lastName: user.lastName,
        role: user.role,
        assignedWarehouse: user.assignedWarehouse,
        permissions: user.permissions,
      };
      await axios.put(`http://localhost:3000/api/users/${userId}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(users.map(u => u._id === userId ? { ...u, isActive: newActive } : u));
      setFilteredUsers(filteredUsers.map(u => u._id === userId ? { ...u, isActive: newActive } : u));
      toast.success(`User ${newActive ? 'activated' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error toggling user active status:', error);
      toast.error('Failed to update user status');
    }
  };

  if (!token || userRole !== 'admin') return null;

  return (
    <div className="p-6 max-w-screen mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
          <p className="text-sm text-gray-500">Manage all system users and their permissions</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search users..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className={`flex items-center justify-center px-4 py-2 rounded-lg text-white font-medium transition-colors ${warehouses.length === 0
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
              }`}
            disabled={warehouses.length === 0}
          >
            <FaPlus className="mr-2" />
            Add User
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warehouse</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.username}</div>
                            <div className="text-sm text-gray-500">{user.lastName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                          }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {user.assignedWarehouse || 'None'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {user.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-3">
                          <button
                            onClick={() => handleViewPermissions(user._id)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-50 transition-colors"
                            title="View Permissions"
                          >
                            <FaEye />
                          </button>
                          <button
                            onClick={() => handleEditUser(user)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user._id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                          <button
                            onClick={() => handleToggleActive(user._id)}
                            className="text-purple-600 hover:text-purple-900 p-1 rounded-md hover:bg-purple-50 transition-colors"
                            title={user.isActive ? 'Disable' : 'Activate'}
                          >
                            {user.isActive ? '🚫' : '✅'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center">
                      <div className="text-gray-500">No users found</div>
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                        >
                          Clear search
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-[rgb(0,0,0)]/50 flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Edit User' : 'Add New User'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateOrUpdateUser} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password {editingId ? '(Leave blank to keep current)' : '*'}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      required={!editingId}
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={isLoading}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Warehouse *</label>
                    <select
                      value={assignedWarehouse}
                      onChange={(e) => setAssignedWarehouse(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={isLoading || warehouses.length === 0}
                    >
                      {warehouses.map(warehouse => (
                        <option key={warehouse._id} value={warehouse.name}>
                          {warehouse.name} ({warehouse.warehouseCode})
                        </option>
                      ))}
                    </select>
                    {warehouses.length === 0 && (
                      <p className="mt-1 text-sm text-red-600">No warehouses available. Please create a warehouse first.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Permissions</label>
                    {['lotManagement', 'manageDamage', 'category', 'products'].map(feature => (
                      <div key={feature} className="mb-2">
                        <label className="flex items-center space-x-2">
                          <span>{feature.charAt(0).toUpperCase() + feature.slice(1)}</span>
                          <input
                            type="checkbox"
                            checked={permissions.some(p => p.feature === feature)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPermissions([...permissions, { feature, permissions: ['Show', 'Edit', 'Cancel'] }]);
                              } else {
                                setPermissions(permissions.filter(p => p.feature !== feature));
                              }
                            }}
                          />
                        </label>
                        {permissions.find(p => p.feature === feature)?.permissions.map(perm => (
                          <label key={perm} className="ml-4 flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={permissions.find(p => p.feature === feature)?.permissions.includes(perm)}
                              onChange={(e) => {
                                const updatedPerms = permissions.map(p =>
                                  p.feature === feature
                                    ? {
                                      ...p,
                                      permissions: e.target.checked
                                        ? [...(p.permissions || []), perm]
                                        : p.permissions.filter(p => p !== perm)
                                    }
                                    : p
                                );
                                setPermissions(updatedPerms);
                              }}
                            />
                            <span>{perm}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-4 py-2 rounded-lg text-white transition-colors ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : editingId ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {viewPermissionsId && (
        <Modal
          isOpen={isModalOpen && viewPermissionsId}
          onRequestClose={() => setViewPermissionsId(null)}
          style={{
            content: {
              top: '50%',
              left: '50%',
              right: 'auto',
              bottom: 'auto',
              marginRight: '-50%',
              transform: 'translate(-50%, -50%)',
              width: '300px',
              padding: '20px',
            },
          }}
        >
          <h2 className="text-lg font-bold mb-4">User Permissions</h2>
          <p>User: {users.find(u => u._id === viewPermissionsId)?.username}</p>
          {['lotManagement', 'manageDamage', 'category', 'products'].map(feature => {
            const userPerms = users.find(u => u._id === viewPermissionsId)?.permissions.find(p => p.feature === feature)?.permissions || [];
            return (
              <div key={feature} className="mb-2">
                <label className="flex items-center space-x-2">
                  <span>{feature.charAt(0).toUpperCase() + feature.slice(1)}</span>
                </label>
                <div className="ml-4">
                  {['Show', 'Edit', 'Cancel'].map(perm => (
                    <label key={perm} className="flex items-center space-x-2">
                      <input type="checkbox" checked={userPerms.includes(perm)} disabled />
                      <span>{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          <button
            onClick={() => setViewPermissionsId(null)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Close
          </button>
        </Modal>
      )}
    </div>
  );
};

export default Users;