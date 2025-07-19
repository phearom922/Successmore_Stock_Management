import { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaRegEdit, FaSearch, FaPlus, FaRegTrashAlt } from 'react-icons/fa';

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const token = localStorage.getItem('token');
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
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
        toast.error('Unauthorized access: Only admins can manage suppliers');
        navigate('/');
        return;
      }
    } catch {
      localStorage.removeItem('token');
      toast.error('Invalid token, please login again');
      navigate('/login');
      return;
    }

    const fetchSuppliers = async () => {
      setIsLoading(true);
      try {
        console.log('Fetching suppliers, token:', token);
        const response = await axios.get(`${API_BASE_URL}/api/suppliers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Suppliers:', response.data);
        setSuppliers(response.data);
        setFilteredSuppliers(response.data);
      } catch (error) {
        console.error('Error fetching suppliers:', error.response || error);
        if (error.response?.status === 401) {
          toast.error('Session expired, please login again');
          navigate('/login');
        } else {
          toast.error(error.response?.data?.message || 'Failed to load suppliers');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchSuppliers();
  }, [token, navigate, userRole]);

  useEffect(() => {
    const results = suppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.phone.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredSuppliers(results);
  }, [searchTerm, suppliers]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setAddress('');
    setPhone('');
    setIsModalOpen(false);
  };

  const handleCreateOrUpdateSupplier = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Please login first');
      return;
    }
    if (!name) {
      toast.error('Supplier name is required');
      return;
    }
    setIsLoading(true);
    try {
      const payload = { name, address: address || undefined, phone: phone || undefined };
      console.log('Sending supplier payload:', payload);
      if (editingId) {
        const response = await axios.put(`${API_BASE_URL}/api/suppliers/${editingId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Update supplier response:', response.data);
        setSuppliers(suppliers.map(s => s._id === editingId ? response.data.supplier : s));
        setFilteredSuppliers(filteredSuppliers.map(s => s._id === editingId ? response.data.supplier : s));
        toast.success(response.data.message);
      } else {
        const response = await axios.post(`${API_BASE_URL}/api/suppliers`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Create supplier response:', response.data);
        setSuppliers([...suppliers, response.data.supplier]);
        setFilteredSuppliers([...filteredSuppliers, response.data.supplier]);
        toast.success(response.data.message);
      }
      resetForm();
    } catch (error) {
      console.error('Error creating/updating supplier:', error.response || error);
      toast.error(error.response?.data?.message || 'Network Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditSupplier = (supplier) => {
    console.log('Editing supplier:', supplier);
    setEditingId(supplier._id);
    setName(supplier.name);
    setAddress(supplier.address);
    setPhone(supplier.phone);
    setIsModalOpen(true);
  };

  const handleDeleteSupplier = async (id) => {
    if (!token) {
      toast.error('Please login first');
      return;
    }
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      setIsLoading(true);
      try {
        console.log('Deleting supplier:', id);
        await axios.delete(`${API_BASE_URL}/api/suppliers/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSuppliers(suppliers.filter(s => s._id !== id));
        setFilteredSuppliers(filteredSuppliers.filter(s => s._id !== id));
        toast.success('Supplier deleted successfully');
      } catch (error) {
        console.error('Error deleting supplier:', error.response || error);
        toast.error(error.response?.data?.message || 'Network Error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!token || userRole !== 'admin') return null;

  return (
    <div className="p-6 max-w-screen mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Suppliers Management</h2>
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search suppliers..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-500 hover:bg-blue-600"
        >
          <FaPlus className="mr-2" />
          Create Supplier
        </button>
      </div>
      {isLoading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Address</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Phone</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Created At</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{supplier.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{supplier.address || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{supplier.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(supplier.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEditSupplier(supplier)}
                        className="text-blue-600 hover:text-blue-900 p-2 rounded border border-blue-200 hover:border-blue-300"
                      >
                        <FaRegEdit />
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(supplier._id)}
                        className="text-red-600 hover:text-red-900 p-2 rounded border border-red-200 hover:border-blue-300"
                      >
                        <FaRegTrashAlt />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                    No suppliers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[rgb(0,0,0)]/50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">{editingId ? 'Edit Supplier' : 'Create Supplier'}</h3>
            <form onSubmit={handleCreateOrUpdateSupplier} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Supplier Name"
                  className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Address (Optional)</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Address"
                  className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone (Optional)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                  className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className={`w-full py-2 px-4 rounded text-white ${isLoading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
                  disabled={isLoading}
                >
                  {isLoading ? 'Processing...' : (editingId ? 'Update Supplier' : 'Create Supplier')}
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
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Suppliers;