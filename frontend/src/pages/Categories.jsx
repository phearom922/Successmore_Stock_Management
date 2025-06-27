import { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { AiFillStop } from "react-icons/ai";
import { SiTicktick } from "react-icons/si";

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
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
        toast.error('Unauthorized access: Only admins can manage categories');
        navigate('/');
        return;
      }
    } catch {
      localStorage.removeItem('token');
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
  }, [token, navigate, userRole]);

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
      <span className="flex items-center">
        <SiTicktick className="mr-1 text-green-500" /> In Use
      </span>
    ) : (
      <span className="flex items-center">
        <AiFillStop className="mr-1 text-red-500" /> Not In Use
      </span>
    );
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Categories</h2>
      <button
        onClick={() => setIsModalOpen(true)}
        className="mb-4 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
      >
        Add Category
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
                <h3 className="text-lg font-bold mb-4">{editingId ? 'Edit Category' : 'Create Category'}</h3>
                <form onSubmit={handleCreateOrUpdateCategory} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Category Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Category Name"
                      className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Description"
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
                      {isLoading ? 'Processing...' : (editingId ? 'Update Category' : 'Create Category')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsModalOpen(false); setEditingId(null); setName(''); setDescription(''); }}
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
                <th className="border p-3 text-left text-sm font-semibold text-gray-600">Name</th>
                <th className="border p-3 text-left text-sm font-semibold text-gray-600">Description</th>
                <th className="border p-3 text-left text-sm font-semibold text-gray-600">Create Date</th>
                <th className="border p-3 text-left text-sm font-semibold text-gray-600">Status</th>
                <th className="border p-3 text-right text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category._id} className="border-b hover:bg-gray-50">
                  <td className="border p-3">{category.name}</td>
                  <td className="border p-3">{category.description || '-'}</td>
                  <td className="border p-3">{new Date(category.createdAt).toLocaleDateString()}</td>
                  <td className="border p-3">{getCategoryStatus(category._id)}</td>
                  <td className="border p-3 text-right">
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="text-blue-500 hover:text-blue-700 mr-3"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category._id)}
                      className="text-red-500 hover:text-red-700"
                      disabled={products.some(p => p.category?._id.toString() === category._id.toString())}
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

export default Categories;