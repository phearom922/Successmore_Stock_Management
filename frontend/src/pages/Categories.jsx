import { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash, FaPlus, FaSearch } from 'react-icons/fa';
import { AiFillStop } from "react-icons/ai";
import { SiTicktick } from "react-icons/si";
import { FiLoader } from "react-icons/fi";

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  // ลบ userRole เพราะใช้ ProtectedRoute แทน

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [categoriesRes, productsRes] = await Promise.all([
          axios.get('http://localhost:3000/api/categories', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:3000/api/products', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setCategories(categoriesRes.data);
        setProducts(productsRes.data);
      } catch (error) {
        if (error.response?.status === 401) {
          toast.error('Session expired, please login again');
          navigate('/login');
        } else {
          toast.error('Failed to load data');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [token, navigate]);

  const handleCreateOrUpdateCategory = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Please login first');
      return;
    }
    if (!name) {
      toast.error('Category name is required');
      return;
    }
    setIsLoading(true);
    try {
      if (editingId) {
        const res = await axios.put(`http://localhost:3000/api/categories/${editingId}`, {
          name,
          description,
        }, { headers: { Authorization: `Bearer ${token}` } });
        setCategories(categories.map(cat => cat._id === editingId ? res.data.category : cat));
        toast.success(res.data.message);
      } else {
        const res = await axios.post('http://localhost:3000/api/categories', {
          name,
          description,
        }, { headers: { Authorization: `Bearer ${token}` } });
        setCategories([...categories, res.data.category]);
        toast.success(res.data.message);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setName('');
      setDescription('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Network Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCategory = (category) => {
    setEditingId(category._id);
    setName(category.name);
    setDescription(category.description || '');
    setIsModalOpen(true);
  };

  const handleDeleteCategory = async (id) => {
    if (!token) {
      toast.error('Please login first');
      return;
    }
    if (window.confirm('Are you sure you want to delete this category?')) {
      setIsLoading(true);
      try {
        await axios.delete(`http://localhost:3000/api/categories/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        setCategories(categories.filter(cat => cat._id !== id));
        toast.success('Category deleted successfully');
      } catch (error) {
        toast.error(error.response?.data?.message || 'Network Error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getCategoryStatus = (categoryId) => {
    const usedCategories = products.filter(p => p.category && p.category._id && p.category._id.toString() === categoryId.toString());
    return usedCategories.length > 0 ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <SiTicktick className="mr-1" /> In Use
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <AiFillStop className="mr-1" /> Not In Use
      </span>
    );
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-screen mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Category Management</h1>
              <p className="text-gray-600">Manage product categories and their status</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto mt-4 md:mt-0">
              <div className="relative flex-grow">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search categories..."
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
                Add Category
              </button>
            </div>
          </div>

          {isModalOpen && (
            <div className="fixed inset-0 bg-[rgb(0,0,0)]/50 flex justify-center items-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-indigo-600 p-4 text-white">
                  <h3 className="text-lg font-bold">{editingId ? 'Edit Category' : 'Create New Category'}</h3>
                </div>
                
                <form onSubmit={handleCreateOrUpdateCategory} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Electronics"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      rows="3"
                      disabled={isLoading}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => { setIsModalOpen(false); setEditingId(null); setName(''); setDescription(''); }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`px-4 py-2 flex items-center justify-center ${isLoading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-md transition-colors duration-200`}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <FiLoader className="animate-spin mr-2" />
                          Processing...
                        </>
                      ) : editingId ? 'Update Category' : 'Create Category'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <FiLoader className="animate-spin text-4xl text-indigo-600" />
            </div>
          ) : (
            <>
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category Name
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredCategories.length > 0 ? (
                        filteredCategories.map((category) => (
                          <tr key={category._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{category.name}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-500 max-w-xs truncate">
                                {category.description || '-'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">
                                {new Date(category.createdAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getCategoryStatus(category._id)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => handleEditCategory(category)}
                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                                title="Edit"
                              >
                                <FaEdit />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(category._id)}
                                className={`${products.some(p => p.category?._id.toString() === category._id.toString()) 
                                  ? 'text-gray-400 cursor-not-allowed' 
                                  : 'text-red-600 hover:text-red-900'}`}
                                disabled={products.some(p => p.category?._id.toString() === category._id.toString())}
                                title={products.some(p => p.category?._id.toString() === category._id.toString()) 
                                  ? "Cannot delete category in use" 
                                  : "Delete category"}
                              >
                                <FaTrash />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                          No categories found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </>
          )}
        </div>
        <ToastContainer position="top-right" autoClose={3000} />
      </div>
    </div>
  );
};

export default Categories;