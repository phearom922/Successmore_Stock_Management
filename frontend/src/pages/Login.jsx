import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FaEye, FaEyeSlash, FaUser, FaLock, FaSpinner } from "react-icons/fa";
import scm_logo from "../../public/SCM-Logo.png"; // Assuming you have a logo image in your assets

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error(
        <span className="font-kantumruy">
          សូមបញ្ចូលទាំងឈ្មោះ និងពាក្យសម្ងាត់
        </span>,
      );
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/login`, {
        username,
        password,
      });
      localStorage.setItem("token", data.token);
      toast.success(<span className="font-kantumruy">ការចូលបានជោគជ័យ</span>);

      //wait for a moment before redirecting
      setTimeout(() => {
        navigate("/");
      }, 1000);
      // navigate("/");
    } catch (error) {
      toast.error(
        (
          <span className="font-kantumruy">
            {error.response?.data?.message}
          </span>
        ) || <span className="font-kantumruy">ការចូលបរាជ័យ</span>,
      );
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-sm space-y-8 rounded-md bg-white px-8 py-14 shadow-md">
        <div className="text-center">
          <div className="flex justify-center p-2">
            <img className="max-w-65" src={scm_logo} alt="" />
          </div>
          {/* <h2 className="text-3xl font-bold text-gray-700">Welcome Back</h2> */}
          {/* <p className="mt-2 text-sm text-gray-600">Sign in to your account to manage your inventory</p> */}
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <FaUser className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  className="block w-full rounded-md border border-gray-300 py-2 pr-3 pl-10 placeholder-gray-400 transition duration-200 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <FaLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="block w-full rounded-md border border-gray-300 py-2 pr-10 pl-10 placeholder-gray-400 transition duration-200 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <FaEyeSlash className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                  ) : (
                    <FaEye className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`group relative flex w-full cursor-pointer justify-center rounded-md bg-gradient-to-br from-orange-500 to-orange-700 px-4 py-3 text-sm font-medium text-white transition duration-200 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none ${isLoading ? "cursor-not-allowed opacity-75" : ""}`}
            >
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                {isLoading ? (
                  <FaSpinner className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <svg
                    className="h-5 w-5 text-white group-hover:text-blue-200"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </span>
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>
      </div>
      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar={true}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
};

export default Login;
