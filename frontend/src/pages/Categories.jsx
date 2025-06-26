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
        toast.error('Unauthorized access: Only admins can manage categories');
        navigate('/');
        return;
      }
      const fetchData = async () => {
        try {
          const [categoriesRes, productsRes] = await Promise.all([
            axios.get('http://localhost:3000/api/categories', {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get('http://localhost:3000/api/products', {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);
          setCategories(categoriesRes.data);
          setProducts(productsRes.data);
        } catch (error) {
          console.error('Error fetching data:', error);
          toast.error('Failed to load data');
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
      try {
        if (editingId) {
          const res = await axios.put(`http://localhost:3000/api/categories/${editingId}`, {
            name,
            description,
          }, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setCategories(categories.map(cat => cat._id === editingId ? res.data.category : cat));
          setEditingId(null);
          setName('');
          setDescription('');
          setMessage(res.data.message);
          toast.success('Category updated successfully!');
        } else {
          const res = await axios.post('http://localhost:3000/api/categories', {
            name,
            description,
          }, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMessage(res.data.message);
          setCategories([...categories, res.data.category]);
          setName('');
          setDescription('');
          toast.success('Category created successfully!');
        }
      } catch (error) {
        setMessage(error.response?.data?.message || 'Error processing category');
        toast.error(error.response?.data?.message || 'Network Error');
      }
    };

    const handleEditCategory = (category) => {
      console.log('Editing category:', category);
      setEditingId(category._id);
      setName(category.name);
      setDescription(category.description || '');
    };

    const handleDeleteCategory = async (id) => {
      if (!token) {
        toast.error('Please login first');
        return;
      }
      try {
        const res = await axios.delete(`http://localhost:3000/api/categories/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCategories(categories.filter(cat => cat._id !== id));
        toast.success(res.data.message);
      } catch (error) {
        setMessage(error.response?.data?.message || 'Error deleting category');
        toast.error(error.response?.data?.message || 'Network Error');
      }
    };

    const getCategoryStatus = (categoryId) => {
      const usedCategories = products.filter(p => p.category && p.category._id && p.category._id.toString() === categoryId.toString());
      return usedCategories.length > 0 ? <SiTicktick size={20}  className='text-green-500'/> : <AiFillStop size={20}  className='text-red-500'/>;
    };

    if (!token || userRole !== 'admin') return null;

    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Categories</h2>
        <form onSubmit={handleCreateOrUpdateCategory} className="space-y-4 mb-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category Name"
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full p-2 border rounded"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white p-2 rounded"
          >
            {editingId ? 'Update Category' : 'Create Category'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setName(''); setDescription(''); }}
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
              <th className="border p-2">Name</th>
              <th className="border p-2">Description</th>
              <th className="border p-2">Create Date</th>
              <th className="border p-2">Status</th>
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category._id} className="border">
                <td className="border p-2">{category.name}</td>
                <td className="border p-2">{category.description}</td>
                <td className="border p-2">{new Date(category.createdAt).toLocaleDateString()}</td>
                <td className="border p-2">{getCategoryStatus(category._id)}</td>
                <td className="border p-2">
                  <button
                    onClick={() => handleEditCategory(category)}
                    className="text-blue-500 mr-2"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category._id)}
                    className="text-red-500"
                    disabled={getCategoryStatus(category._id) === 'In Use'}
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

  export default Categories;