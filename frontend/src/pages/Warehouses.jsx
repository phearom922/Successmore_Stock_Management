import { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash, FaPlus, FaSearch, FaWarehouse, FaUserAlt } from 'react-icons/fa';
import { HiStatusOnline, HiStatusOffline } from 'react-icons/hi';

const Warehouses = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [users, setUsers] = useState([]);
  const [warehouseCode, setWarehouseCode] = useState('');
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [status, setStatus] = useState('Active');
  const [assignedUser, setAssignedUser] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const userRole = token ? JSON.parse(atob(token.split('.')[1])).role : '';

  useEffect(() => {
    if (!token || userRole !== 'admin') {
      navigate('/login');
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
    setIsModalOpen(false);
  };

  const handleCreateOrUpdateWarehouse = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Please login first');
      return;
    }
    try {
      const payload = { warehouseCode, name, branch, status, assignedUser };
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
    setIsModalOpen(true);
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
      toast.error('Failed to update status');
    }
  };

  const filteredWarehouses = warehouses.filter(warehouse => 
    warehouse.warehouseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouse.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouse.branch.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!token || userRole !== 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div className="flex items-center mb-4 md:mb-0">
            <FaWarehouse className="text-indigo-600 text-3xl mr-3" />
            <h1 className="text-2xl font-bold text-gray-800">Warehouse Management</h1>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="relative flex-grow">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search warehouses..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors duration-200"
            >
              <FaPlus className="mr-2" />
              Add Warehouse
            </button>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-[rgb(0,0,0)]/50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-indigo-600 p-4 text-white">
                <h3 className="text-lg font-bold">{editingId ? 'Edit Warehouse' : 'Create New Warehouse'}</h3>
              </div>
              
              <form onSubmit={handleCreateOrUpdateWarehouse} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse Code</label>
                  <input
                    type="text"
                    value={warehouseCode}
                    onChange={(e) => setWarehouseCode(e.target.value)}
                    placeholder="WH-001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Main Warehouse"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="Headquarters"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned User</label>
                  <select
                    value={assignedUser}
                    onChange={(e) => setAssignedUser(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">No User Assigned</option>
                    {users.map(user => (
                      <option
                        key={user._id}
                        value={user._id}
                        disabled={user.assignedWarehouse && user.assignedWarehouse._id !== editingId}
                      >
                        {user.username}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors duration-200"
                  >
                    {editingId ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned User
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWarehouses.length > 0 ? (
                  filteredWarehouses.map((warehouse) => (
                    <tr key={warehouse._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {warehouse.warehouseCode}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {warehouse.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {warehouse.branch}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(warehouse)}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            warehouse.status === 'Active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {warehouse.status === 'Active' ? (
                            <HiStatusOnline className="mr-1" />
                          ) : (
                            <HiStatusOffline className="mr-1" />
                          )}
                          {warehouse.status}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {warehouse.assignedUser ? (
                          <span className="inline-flex items-center">
                            <FaUserAlt className="mr-1 text-indigo-500" />
                            {warehouse.assignedUser.username}
                          </span>
                        ) : (
                          'None'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditWarehouse(warehouse)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDeleteWarehouse(warehouse._id)}
                          className={`${warehouse.status === 'Active' ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
                          disabled={warehouse.status === 'Active'}
                          title={warehouse.status === 'Active' ? 'Cannot delete active warehouse' : 'Delete'}
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                      No warehouses found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Warehouses;