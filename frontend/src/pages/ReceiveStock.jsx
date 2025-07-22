import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaCalendarAlt } from "react-icons/fa";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as Select from "@radix-ui/react-select";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const ReceiveStock = () => {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [currentLot, setCurrentLot] = useState({
    productId: "",
    lotCode: "",
    quantity: "",
    boxCount: "",
    qtyPerBox: "",
    productionDate: null,
    expDate: null,
    warehouse: "",
    supplierId: "",
  });
  const [addedLots, setAddedLots] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const user = token ? JSON.parse(atob(token.split(".")[1])) : {};
  const productInputRef = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem("token");
        // toast.error("Session expired, please login again");
        navigate("/login");
        return;
      }
    } catch {
      localStorage.removeItem("token");
      // toast.error("Invalid token, please login again");
      navigate("/login");
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [productsRes, categoriesRes, warehousesRes, suppliersRes] =
          await Promise.all([
            axios.get(`${API_BASE_URL}/api/products`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_BASE_URL}/api/categories`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_BASE_URL}/api/warehouses`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_BASE_URL}/api/suppliers`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

        setProducts(productsRes.data || []);
        setCategories(categoriesRes.data || []);
        setWarehouses(warehousesRes.data || []);
        setSuppliers(suppliersRes.data || []);

        // === ตั้งค่า default warehouse ===
        let defaultWarehouseId = "";

        if (user.role === "admin") {
          const assignedWarehouseExists = warehousesRes.data.find(
            (w) => w._id === user.warehouse,
          );
          defaultWarehouseId = assignedWarehouseExists
            ? user.warehouse
            : warehousesRes.data.length > 0
              ? warehousesRes.data[0]._id
              : "";
        } else {
          defaultWarehouseId = user.warehouse || "";
        }

        const defaultSupplier =
          suppliersRes.data.length > 0 ? suppliersRes.data[0]._id : "";

        setSelectedWarehouseId(defaultWarehouseId);
        setSelectedSupplier(defaultSupplier);
        setCurrentLot((prev) => ({
          ...prev,
          warehouse: defaultWarehouseId,
          supplierId: defaultSupplier,
        }));
      } catch (error) {
        console.error("Error fetching data:", error.response || error);
        if (error.response?.status === 401) {
          // toast.error("Session expired, please login again");
          navigate("/login");
        } else {
          toast.error(error.response?.data?.message || "Failed to load data");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [token, navigate, user.role, user.warehouse]);

  const updateCurrentLot = (field, value) => {
    const updatedLot = { ...currentLot, [field]: value };
    if (field === "boxCount" || field === "qtyPerBox") {
      updatedLot.quantity =
        Number(updatedLot.boxCount) * Number(updatedLot.qtyPerBox) || "";
    }
    setCurrentLot(updatedLot);
  };

  const addLot = () => {
    if (
      !currentLot.productId ||
      !currentLot.lotCode ||
      !currentLot.boxCount ||
      !currentLot.qtyPerBox ||
      !currentLot.productionDate ||
      !currentLot.expDate
    ) {
      toast.error("Please fill all required fields before adding a lot");
      return;
    }
    if (Number(currentLot.boxCount) <= 0 || Number(currentLot.qtyPerBox) <= 0) {
      toast.error(
        <span className="font-kantumruy">
          បរិមាណ ចំនួនប្រអប់ និងបរិមាណក្នុងមួយប្រអប់ត្រូវតែវិជ្ជមាន
        </span>,
      );
      return;
    }
    if (new Date(currentLot.expDate) <= new Date(currentLot.productionDate)) {
      toast.error(
        <span className="font-kantumruy">
          ថ្ងៃផុតកំណត់ ត្រូវតែធំជាងថ្ងៃផលិត
        </span>,
      );
      return;
    }

    const computedQuantity =
      Number(currentLot.boxCount) * Number(currentLot.qtyPerBox);
    const newLot = {
      ...currentLot,
      quantity: computedQuantity,
      warehouse: selectedWarehouseId,
      supplierId: selectedSupplier,
    };

    setAddedLots((prevLots) => {
      const existingIndex = prevLots.findIndex(
        (lot) => lot.lotCode === currentLot.lotCode,
      );
      if (existingIndex !== -1) {
        const updatedLots = [...prevLots];
        updatedLots[existingIndex] = newLot;
        return updatedLots;
      } else {
        return [...prevLots, newLot];
      }
    });

    setCurrentLot({
      productId: "",
      lotCode: "",
      quantity: "",
      boxCount: "",
      qtyPerBox: "",
      productionDate: null,
      expDate: null,
      warehouse: selectedWarehouseId,
      supplierId: selectedSupplier,
    });
  };

  const removeLot = (index) => {
    setAddedLots(addedLots.filter((_, i) => i !== index));
  };

  const editLot = (index) => {
    const lotToEdit = addedLots[index];
    setCurrentLot(lotToEdit);
    removeLot(index);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error("Please login first");
      return;
    }
    const warehouseValid = warehouses.some(
      (w) => w._id === selectedWarehouseId,
    );
    const supplierValid = suppliers.some((s) => s._id === selectedSupplier);
    if (!warehouseValid || !supplierValid || addedLots.length === 0) {
      toast.error(
        `Please ensure ${!warehouseValid ? "Warehouse" : ""}${!warehouseValid && !supplierValid ? " and " : ""}${!supplierValid ? "Supplier" : ""} are valid and add at least one lot`,
      );
      return;
    }

    // Validate all lots before submission
    for (const lot of addedLots) {
      if (
        !lot.productId ||
        !lot.lotCode ||
        !lot.quantity ||
        !lot.boxCount ||
        !lot.qtyPerBox ||
        !lot.productionDate ||
        !lot.expDate
      ) {
        toast.error("All fields in added lots must be filled");
        return;
      }
      if (lot.quantity <= 0 || lot.boxCount <= 0 || lot.qtyPerBox <= 0) {
        toast.error(
          <span className="font-kantumruy">
            បរិមាណ ចំនួនប្រអប់ និងបរិមាណក្នុងមួយប្រអប់ត្រូវតែវិជ្ជមាន
          </span>,
        );
        return;
      }
      if (new Date(lot.expDate) <= new Date(lot.productionDate)) {
        toast.error(
          <span className="font-kantumruy">
            កាលបរិច្ឆេទផុតកំណត់ ត្រូវតែធំជាងកាលបរិច្ឆេទផលិត
          </span>,
        );
        return;
      }
      if (lot.quantity !== lot.boxCount * lot.qtyPerBox) {
        toast.error("Quantity must equal Box Count * Quantity per Box");
        return;
      }
    }

    // คำนวณข้อมูลสำหรับ Modal
    const totalStockItems = addedLots.length;
    const totalBoxes = addedLots.reduce(
      (sum, lot) => sum + Number(lot.boxCount),
      0,
    );
    const totalQuantity = addedLots.reduce(
      (sum, lot) => sum + Number(lot.quantity),
      0,
    );

    // แสดง Modal Confirm
    setShowConfirmModal(true);
  };

  const confirmReceive = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);
    try {
      const payload = {
        lots: addedLots.map((lot) => ({
          productId: lot.productId,
          lotCode: lot.lotCode,
          quantity: Number(lot.quantity),
          boxCount: Number(lot.boxCount),
          qtyPerBox: Number(lot.qtyPerBox),
          productionDate: lot.productionDate.toISOString(),
          expDate: lot.expDate.toISOString(),
          warehouse: lot.warehouse,
          supplierId: lot.supplierId,
        })),
      };
      console.log("Payload being sent:", JSON.stringify(payload, null, 2));
      const response = await axios.post(
        `${API_BASE_URL}/api/receive`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      toast.success(
        response.data.message || (
          <span className="font-kantumruy">បញ្ជូលស្តុកដោយជោគជ័យ!</span>
        ),
      );
      setAddedLots([]);
      setCurrentLot({
        productId: "",
        lotCode: "",
        quantity: "",
        boxCount: "",
        qtyPerBox: "",
        productionDate: null,
        expDate: null,
        warehouse: selectedWarehouseId,
        supplierId: selectedSupplier,
      });
    } catch (error) {
      console.error("Error receiving stock:", error.response || error);
      const errorMessage = error.response?.data?.message || (
        <span className="font-kantumruy">
          បរាជ័យក្នុងការបញ្ជូលស្តុក សូមព្យាយាមម្តងទៀត
        </span>
      );
      toast.error(errorMessage);
      if (error.response?.status === 401) {
        navigate("/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const cancelReceive = () => {
    setShowConfirmModal(false);
  };

  const filteredProducts =
    selectedCategory === "All"
      ? products
      : products.filter(
          (p) => p.category && p.category._id === selectedCategory,
        );

  const handleProductSearch = (e) => {
    const value = e.target.value;
    setProductSearch(value);
    let results = [];
    if (value.trim() === "") {
      results = filteredProducts;
    } else {
      const search = value.toLowerCase();
      results = filteredProducts.filter(
        (product) =>
          product.productCode?.toLowerCase().includes(search) ||
          product.name?.toLowerCase().includes(search),
      );
    }
    setSearchResults(results);
    setShowProductDropdown(true);
  };

  const handleProductSelect = (productId) => {
    setCurrentLot((prev) => ({ ...prev, productId }));
    const selected = filteredProducts.find((p) => p._id === productId);
    setProductSearch(
      selected ? `${selected.name} (${selected.productCode})` : "",
    );
    setShowProductDropdown(false);
    if (productInputRef && productInputRef.current)
      productInputRef.current.blur();
  };

  const handleAddLot = () => {
    addLot();
    setProductSearch("");
  };

  if (!token) return null;

  return (
    <div className="mx-auto max-w-screen rounded-xl bg-gray-50 p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Receive Stock</h1>
          <p className="text-gray-600">
            Record stock receive and create new lots
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={handleSubmit}
            className={`inline-flex items-center rounded-lg border border-transparent px-5 py-2.5 text-sm font-medium text-white shadow-sm ${isLoading ? "cursor-not-allowed bg-blue-300" : "bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"}`}
            disabled={isLoading || addedLots.length === 0}
          >
            {isLoading ? "Processing..." : "Receive Stock"}
          </button>
        </div>
      </div>

      {isLoading && !products.length ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <Tabs
                onSelect={(index) =>
                  setSelectedCategory(
                    index === 0 ? "All" : categories[index - 1]._id,
                  )
                }
              >
                <TabList className="flex space-x-1 rounded-lg bg-gray-100 p-1">
                  <Tab className="ui-selected:bg-white ui-selected:shadow ui-selected:text-blue-600 cursor-pointer rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:text-blue-500">
                    All Products
                  </Tab>
                  {categories.map((category) => (
                    <Tab
                      key={category._id}
                      className="ui-selected:bg-white ui-selected:shadow ui-selected:text-blue-600 cursor-pointer rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:text-blue-500"
                    >
                      {category.name}
                    </Tab>
                  ))}
                </TabList>
                {["All", ...categories.map((c) => c._id)].map((_, index) => (
                  <TabPanel key={index}></TabPanel>
                ))}
              </Tabs>
            </div>
            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Warehouse
                </label>
                <Select.Root
                  value={selectedWarehouseId}
                  onValueChange={(value) => {
                    setSelectedWarehouseId(value);
                    setCurrentLot((prev) => ({ ...prev, warehouse: value }));
                  }}
                  disabled={user.role !== "admin" || isLoading}
                >
                  <Select.Trigger
                    className={`${user.role === "user" ? "bg-gray-200 text-gray-500" : "bg-white"} relative mt-1 block w-full appearance-none rounded-lg border border-gray-300 py-2.5 pr-10 pl-3 text-base transition-colors duration-200 hover:bg-gray-100 focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm`}
                  >
                    <Select.Value placeholder="Select warehouse" />
                    <Select.Icon className="absolute top-1/2 right-3 -translate-y-1/2 transform">
                      <ChevronDownIcon />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Content className="mt-1 rounded-lg border border-gray-300 bg-white shadow-lg">
                    <Select.ScrollUpButton className="flex h-6 items-center justify-center bg-gray-100 text-gray-600">
                      <ChevronUpIcon />
                    </Select.ScrollUpButton>
                    <Select.Viewport>
                      <Select.Group>
                        <Select.Label className="px-3 py-1.5 text-sm text-gray-500">
                          Warehouses
                        </Select.Label>
                        {warehouses.map((w) => (
                          <Select.Item
                            key={w._id}
                            value={w._id}
                            className="m-2 cursor-pointer rounded-sm px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 focus:bg-blue-100 focus:outline-none"
                            disabled={
                              user.role !== "admin" && w._id !== user.warehouse
                            } // เปลี่ยนจาก user.assignedWarehouse
                          >
                            <Select.ItemText>
                              {w.name} ({w.warehouseCode})
                            </Select.ItemText>
                            <Select.ItemIndicator className="absolute right-2 inline-flex items-center">
                              <CheckIcon />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex h-6 items-center justify-center bg-gray-100 text-gray-600">
                      <ChevronDownIcon />
                    </Select.ScrollDownButton>
                  </Select.Content>
                </Select.Root>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Supplier
                </label>
                <Select.Root
                  value={selectedSupplier}
                  onValueChange={(value) => {
                    setSelectedSupplier(value);
                    setCurrentLot((prev) => ({ ...prev, supplierId: value }));
                  }}
                  disabled={isLoading}
                >
                  <Select.Trigger className="relative mt-1 block w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pr-10 pl-3 text-base transition-colors duration-200 hover:bg-gray-100 focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm">
                    <Select.Value placeholder="Select supplier" />
                    <Select.Icon className="absolute top-1/2 right-3 -translate-y-1/2 transform">
                      <ChevronDownIcon />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Content className="mt-1 rounded-lg border border-gray-300 bg-white shadow-lg">
                    <Select.ScrollUpButton className="flex h-6 items-center justify-center bg-gray-100 text-gray-600">
                      <ChevronUpIcon />
                    </Select.ScrollUpButton>
                    <Select.Viewport>
                      <Select.Group>
                        <Select.Label className="px-3 py-1.5 text-sm text-gray-500">
                          Suppliers
                        </Select.Label>
                        {suppliers.map((s) => (
                          <Select.Item
                            key={s._id}
                            value={s._id}
                            className="m-2 cursor-pointer rounded-sm px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 focus:bg-blue-100 focus:outline-none"
                          >
                            <Select.ItemText>{s.name}</Select.ItemText>
                            <Select.ItemIndicator className="absolute right-2 inline-flex items-center">
                              <CheckIcon />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex h-6 items-center justify-center bg-gray-100 text-gray-600">
                      <ChevronDownIcon />
                    </Select.ScrollDownButton>
                  </Select.Content>
                </Select.Root>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
              <h3 className="mb-4 text-lg font-medium text-gray-900">
                Add New Stock Item
              </h3>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Product <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      ref={productInputRef}
                      type="text"
                      placeholder="Search by product code or name..."
                      className="mb-2 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                      value={productSearch}
                      onChange={handleProductSearch}
                      onFocus={() => {
                        setShowProductDropdown(true);
                        setSearchResults(filteredProducts);
                      }}
                      onBlur={() =>
                        setTimeout(() => setShowProductDropdown(false), 150)
                      }
                      disabled={isLoading}
                      autoComplete="off"
                    />
                    {showProductDropdown && searchResults.length > 0 && (
                      <ul className="absolute z-10 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
                        {searchResults.map((product) => (
                          <li
                            key={product._id}
                            className={`cursor-pointer px-3 py-2 text-sm hover:bg-blue-100 ${currentLot.productId === product._id ? "bg-blue-600 text-white" : "text-gray-700"}`}
                            onMouseDown={() => handleProductSelect(product._id)}
                          >
                            {product.name} ({product.productCode})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Lot Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentLot.lotCode}
                    onChange={(e) =>
                      updateCurrentLot("lotCode", e.target.value)
                    }
                    placeholder="Enter lot code"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Box Count <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={currentLot.boxCount}
                    onChange={(e) =>
                      updateCurrentLot("boxCount", e.target.value)
                    }
                    placeholder="Enter box count"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                    disabled={isLoading}
                    min="1"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Quantity per Box <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={currentLot.qtyPerBox}
                    onChange={(e) =>
                      updateCurrentLot("qtyPerBox", e.target.value)
                    }
                    placeholder="Enter quantity per box"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                    disabled={isLoading}
                    min="1"
                  />
                </div>

                <div className="mt-1">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Quantity (auto-calculated)
                  </label>
                  <input
                    type="number"
                    value={currentLot.quantity}
                    placeholder="Auto-calculated"
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2.5 shadow-sm sm:text-sm"
                    disabled
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Production Date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <DatePicker
                        selected={currentLot.productionDate}
                        onChange={(date) =>
                          updateCurrentLot("productionDate", date)
                        }
                        className="mt-1 block w-full rounded-lg border border-gray-300 py-2.5 pr-3 pl-10 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                        disabled={isLoading}
                        dateFormat="dd-MM-yyyy"
                        placeholderText="Select production date"
                        minDate={
                          new Date(
                            new Date().setFullYear(
                              new Date().getFullYear() - 5,
                            ),
                          )
                        }
                        maxDate={new Date()}
                        showYearDropdown
                        scrollableYearDropdown
                        yearDropdownItemNumber={15}
                        showMonthDropdown
                        dropdownMode="select"
                      />
                      <FaCalendarAlt className="absolute top-3.5 left-3 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Expiration Date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <DatePicker
                        selected={currentLot.expDate}
                        onChange={(date) => updateCurrentLot("expDate", date)}
                        className="mt-1 block w-full rounded-lg border border-gray-300 py-2.5 pr-3 pl-10 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                        disabled={isLoading}
                        dateFormat="dd-MM-yyyy"
                        placeholderText="Select expiration date"
                        minDate={currentLot.productionDate || new Date()}
                        showYearDropdown
                        scrollableYearDropdown
                        yearDropdownItemNumber={15}
                        showMonthDropdown
                        dropdownMode="select"
                      />
                      <FaCalendarAlt className="absolute top-3.5 left-3 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddLot}
                  className="inline-flex items-center rounded-lg border border-transparent bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
                  disabled={
                    isLoading ||
                    !currentLot.productId ||
                    !currentLot.lotCode ||
                    !currentLot.boxCount ||
                    !currentLot.qtyPerBox ||
                    !currentLot.productionDate ||
                    !currentLot.expDate
                  }
                >
                  <FaPlus className="mr-2" />
                  Add Stock Item
                </button>
              </div>
            </div>
          </div>

          {addedLots.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-medium text-gray-900">
                Stock Items to Receive ({addedLots.length})
              </h3>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                      >
                        Product
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                      >
                        Lot Code
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                      >
                        Quantity
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                      >
                        Boxes
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                      >
                        Qty/Box
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                      >
                        Prod Date
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                      >
                        Exp Date
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
                    {addedLots.map((lot, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                          {products.find((p) => p._id === lot.productId)
                            ?.name || "-"}
                          <span className="block text-xs text-gray-500">
                            {products.find((p) => p._id === lot.productId)
                              ?.productCode || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="text"
                            value={lot.lotCode}
                            onChange={(e) => {
                              const updatedLots = [...addedLots];
                              updatedLots[index].lotCode = e.target.value;
                              setAddedLots(updatedLots);
                            }}
                            className="block w-full rounded-md border border-gray-300 px-3 py-1.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            value={lot.quantity}
                            disabled
                            className="block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-1.5 shadow-sm sm:text-sm"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            value={lot.boxCount}
                            onChange={(e) => {
                              const updatedLots = [...addedLots];
                              updatedLots[index].boxCount = Number(
                                e.target.value,
                              );
                              updatedLots[index].quantity =
                                updatedLots[index].boxCount *
                                updatedLots[index].qtyPerBox;
                              setAddedLots(updatedLots);
                            }}
                            className="block w-full rounded-md border border-gray-300 px-3 py-1.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                            min="1"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            value={lot.qtyPerBox}
                            onChange={(e) => {
                              const updatedLots = [...addedLots];
                              updatedLots[index].qtyPerBox = Number(
                                e.target.value,
                              );
                              updatedLots[index].quantity =
                                updatedLots[index].boxCount *
                                updatedLots[index].qtyPerBox;
                              setAddedLots(updatedLots);
                            }}
                            className="block w-full rounded-md border border-gray-300 px-3 py-1.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                            min="1"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <DatePicker
                            selected={lot.productionDate}
                            onChange={(date) => {
                              const updatedLots = [...addedLots];
                              updatedLots[index].productionDate = date;
                              setAddedLots(updatedLots);
                            }}
                            className="block w-full rounded-md border border-gray-300 px-3 py-1.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                            dateFormat="dd-MM-yyyy"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <DatePicker
                            selected={lot.expDate}
                            onChange={(date) => {
                              const updatedLots = [...addedLots];
                              updatedLots[index].expDate = date;
                              setAddedLots(updatedLots);
                            }}
                            className="block w-full rounded-md border border-gray-300 px-3 py-1.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                            dateFormat="dd-MM-yyyy"
                          />
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => removeLot(index)}
                            className="mr-4 text-red-600 hover:text-red-900"
                            disabled={isLoading}
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => editLot(index)}
                            className="text-blue-600 hover:text-blue-900"
                            disabled={isLoading}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </form>
      )}

      {/* Confirm Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Stock Receipt</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p>
              <strong>Total Stock Items to Receive:</strong> {addedLots.length}
            </p>
            <p>
              <strong>Total Boxes:</strong>{" "}
              {addedLots.reduce((sum, lot) => sum + Number(lot.boxCount), 0)}
            </p>
            <p>
              <strong>Total Quantity:</strong>{" "}
              {addedLots.reduce((sum, lot) => sum + Number(lot.quantity), 0)}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelReceive}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={confirmReceive} disabled={isLoading}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
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

export default ReceiveStock;
