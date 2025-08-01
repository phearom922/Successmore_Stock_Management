import { useState, useEffect } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import { FaEdit, FaTrash, FaPlus, FaSearch } from "react-icons/fa";
import { AiFillStop } from "react-icons/ai";
import { SiTicktick } from "react-icons/si";
import { FiLoader } from "react-icons/fi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  // ดึง userRole จาก token (decode JWT)
  let userRole = "";
  try {
    if (token) {
      userRole = JSON.parse(atob(token.split(".")[1])).role || "";
    }
  } catch {}

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [categoriesRes, productsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/categories`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_BASE_URL}/api/products`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setCategories(categoriesRes.data);
        setProducts(productsRes.data);
      } catch (error) {
        if (error.response?.status === 401) {
          toast.error("Session expired, please login again");
          navigate("/login");
        } else {
          toast.error("Failed to load data");
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
      toast.error("Please login first");
      return;
    }
    if (!name) {
      toast.error("Category name is required");
      return;
    }
    setIsLoading(true);
    try {
      if (editingId) {
        const res = await axios.put(
          `${API_BASE_URL}/api/categories/${editingId}`,
          {
            name,
            description,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setCategories(
          categories.map((cat) =>
            cat._id === editingId ? res.data.category : cat,
          ),
        );
        toast.success(res.data.message);
      } else {
        const res = await axios.post(
          `${API_BASE_URL}/api/categories`,
          {
            name,
            description,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setCategories([...categories, res.data.category]);
        toast.success(res.data.message);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setName("");
      setDescription("");
    } catch (error) {
      toast.error(error.response?.data?.message || "Network Error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCategory = (category) => {
    setEditingId(category._id);
    setName(category.name);
    setDescription(category.description || "");
    setIsModalOpen(true);
  };

  const handleDeleteCategory = async (id) => {
    if (!token) {
      toast.error("Please login first");
      return;
    }
    if (window.confirm("Are you sure you want to delete this category?")) {
      setIsLoading(true);
      try {
        await axios.delete(`${API_BASE_URL}/api/categories/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCategories(categories.filter((cat) => cat._id !== id));
        toast.success("Category deleted successfully");
      } catch (error) {
        toast.error(error.response?.data?.message || "Network Error");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getCategoryStatus = (categoryId) => {
    const usedCategories = products.filter(
      (p) =>
        p.category &&
        p.category._id &&
        p.category._id.toString() === categoryId.toString(),
    );
    return usedCategories.length > 0 ? (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        <SiTicktick className="mr-1" /> In Use
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
        <AiFillStop className="mr-1" /> Not In Use
      </span>
    );
  };

  const filteredCategories = categories.filter(
    (category) =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (category.description &&
        category.description.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-screen">
          <div className="mb-8 flex flex-col items-start justify-between md:flex-row md:items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Category Management
              </h1>
              <p className="text-gray-600">
                Manage product categories and their status
              </p>
            </div>

            <div className="mt-4 flex w-full flex-col gap-4 sm:flex-row md:mt-0 md:w-auto">
              <div className="relative flex-grow">
                <FaSearch className="absolute top-1/2 left-3 -translate-y-1/2 transform text-gray-400" />
                <input
                  type="text"
                  placeholder="Search categories..."
                  className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors duration-200 hover:bg-indigo-700"
              >
                <FaPlus className="mr-2" />
                Add Category
              </button>
            </div>
          </div>

          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(0,0,0)]/50 p-4">
              <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="bg-indigo-600 p-4 text-white">
                  <h3 className="text-lg font-bold">
                    {editingId ? "Edit Category" : "Create New Category"}
                  </h3>
                </div>

                <form
                  onSubmit={handleCreateOrUpdateCategory}
                  className="space-y-4 p-6"
                >
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Electronics"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                      rows="3"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setEditingId(null);
                        setName("");
                        setDescription("");
                      }}
                      className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 transition-colors duration-200 hover:bg-gray-50"
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`flex items-center justify-center px-4 py-2 ${isLoading ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700"} rounded-md text-white transition-colors duration-200`}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <FiLoader className="mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : editingId ? (
                        "Update Category"
                      ) : (
                        "Create Category"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-lg bg-white shadow">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                        >
                          Category Name
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                        >
                          Description
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                        >
                          Created Date
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                        >
                          Status
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filteredCategories.length > 0 ? (
                        filteredCategories.map((category) => (
                          <tr key={category._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {category.name}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="max-w-xs truncate text-sm text-gray-500">
                                {category.description || "-"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">
                                {new Date(
                                  category.createdAt,
                                ).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getCategoryStatus(category._id)}
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                              <button
                                onClick={() =>
                                  userRole === "admin" &&
                                  handleEditCategory(category)
                                }
                                className={`mr-4 ${userRole === "admin" ? "text-indigo-600 hover:text-indigo-900" : "cursor-not-allowed text-gray-400"}`}
                                title={
                                  userRole === "admin"
                                    ? "Edit"
                                    : "Only admin can edit"
                                }
                                disabled={userRole !== "admin"}
                              >
                                <FaEdit />
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteCategory(category._id)
                                }
                                className={`${
                                  products.some(
                                    (p) =>
                                      p.category?._id.toString() ===
                                      category._id.toString(),
                                  )
                                    ? "cursor-not-allowed text-gray-400"
                                    : "text-red-600 hover:text-red-900"
                                }`}
                                disabled={products.some(
                                  (p) =>
                                    p.category?._id.toString() ===
                                    category._id.toString(),
                                )}
                                title={
                                  products.some(
                                    (p) =>
                                      p.category?._id.toString() ===
                                      category._id.toString(),
                                  )
                                    ? "Cannot delete category in use"
                                    : "Delete category"
                                }
                              >
                                <FaTrash />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan="5"
                            className="px-6 py-4 text-center text-sm text-gray-500"
                          >
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
