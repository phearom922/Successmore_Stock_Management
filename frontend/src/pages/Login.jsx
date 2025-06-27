import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please enter both username and password');
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await axios.post('http://localhost:3000/api/login', {
        username,
        password,
      });
      localStorage.setItem('token', data.token);
      toast.success('Login successful!');
      navigate('/'); // ไปหน้า Users หลังล็อกอิน
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form onSubmit={handleLogin} className="p-6 bg-white rounded shadow-md w-96">
        <h2 className="text-2xl font-bold mb-4 text-center">Login</h2>
        <div className="mb-4">
          <label className="block mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-2 border rounded"
            required
            disabled={isLoading}
          />
        </div>
        <div className="mb-4">
          <label className="block mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          className={`w-full p-2 rounded text-white ${isLoading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
          disabled={isLoading}
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <ToastContainer />
    </div>
  );
};

export default Login;