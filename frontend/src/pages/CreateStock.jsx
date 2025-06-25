import { useState, useEffect } from 'react';
  import axios from 'axios';
  import { ToastContainer, toast } from 'react-toastify';
  import 'react-toastify/dist/ReactToastify.css';
  import { useNavigate } from 'react-router-dom';

  const CreateStock = () => {
    const [name, setName] = useState('');
    const [assignedUser, setAssignedUser] = useState('');
    const [users, setUsers] = useState([]);
    const token = localStorage.getItem('token');
    const navigate = useNavigate();
    const userRole = token ? JSON.parse(atob(token.split('.')[1])).role : '';

    useEffect(() => {
      if (!token) {
        navigate('/login');
        return;
      }
      // ถ้าเป็น Admin ดึงรายชื่อ User
      if (userRole === 'admin') {
        const fetchUsers = async () => {
          try {
            const res = await axios.get('http://localhost:3000/api/users', {
              headers: { Authorization: `Bearer ${token}` },
            });
            setUsers(res.data);
          } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Failed to load users');
          }
        };
        fetchUsers();
      } else {
        setUsers([]); // User ทั่วไปไม่เห็นรายชื่อ
      }
    }, [token, navigate, userRole]);

    const handleCreate = async (e) => {
      e.preventDefault();
      if (!token) {
        toast.error('Please login first');
        return;
      }
      try {
        const res = await axios.post('http://localhost:3000/api/warehouses', {
          name,
          assignedUser: assignedUser || null,
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Warehouse created successfully!');
        setTimeout(() => navigate('/issue'), 1000);
      } catch (error) {
        console.error('Create warehouse error:', error);
        toast.error(error.response?.data?.message || 'Error creating warehouse');
      }
    };

    if (!token) return null;

    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">Create Stock</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Warehouse Name"
            className="w-full p-2 border rounded"
            required
          />
          {userRole === 'admin' && (
            <select
              value={assignedUser}
              onChange={(e) => setAssignedUser(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">No User Assigned</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.username}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="bg-green-500 text-white p-2 rounded">
            Create Stock
          </button>
        </form>
        <ToastContainer />
      </div>
    );
  };

  export default CreateStock;