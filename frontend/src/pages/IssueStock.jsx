import React, { useState, useEffect } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
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
import { format } from "date-fns";

const IssueStock = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [lots, setLots] = useState([]);
  const [currentItem, setCurrentItem] = useState({
    lotId: "",
    quantity: "",
    transactionType: "Sale",
  });
  const [addedItems, setAddedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isManualSelection, setIsManualSelection] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productInputRef = React.useRef(null);
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const user = token ? JSON.parse(atob(token.split(".")[1])) : {};

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    fetchData();
  }, [token, navigate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [warehousesRes, productsRes, categoriesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/warehouses`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE_URL}/api/products`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE_URL}/api/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setWarehouses(warehousesRes.data);
      setProducts(
        productsRes.data.map((p) => ({ ...p, _id: p._id.toString() })),
      );
      setCategories(categoriesRes.data);
      console.log("Fetched Products:", productsRes.data);

      let defaultWarehouse = "";
      if (user.warehouse) {
        defaultWarehouse = user.warehouse.toString();
      }
      if (!defaultWarehouse && warehousesRes.data.length > 0) {
        defaultWarehouse = warehousesRes.data[0]._id.toString();
      } else if (!defaultWarehouse) {
        toast.error("No warehouse assigned");
        return;
      }
      setSelectedWarehouse(defaultWarehouse);
      console.log("Default Warehouse set to:", defaultWarehouse);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load data");
      if (error.response?.status === 401) navigate("/login");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLots = async (productId) => {
    if (!productId || !selectedWarehouse) return;
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/lots`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          productId,
          warehouse: selectedWarehouse,
          damagedOnly: currentItem.transactionType === "Waste",
        },
      });
      let filteredLots = data.filter(
        (lot) =>
          lot.warehouse.toString() === selectedWarehouse && lot.qtyOnHand > 0,
      );
      if (currentItem.transactionType === "Waste") {
        filteredLots = filteredLots.filter((lot) => lot.damaged > 0); // กรองเฉพาะ Lot ที่มี damaged
      }
      const sortedLots = filteredLots.sort(
        (a, b) => new Date(a.expDate) - new Date(b.expDate),
      );
      setLots(sortedLots);
      console.log(
        "Fetched and Sorted Lots for Product:",
        productId,
        sortedLots,
      );
      if (!isManualSelection && sortedLots.length > 0) {
        setCurrentItem((prev) => ({ ...prev, lotId: sortedLots[0]._id }));
      }
    } catch (error) {
      toast.error("Failed to load lots");
    }
  };

  const addItem = () => {
    const quantity = Number(currentItem.quantity);
    if (!quantity || !currentItem.transactionType) {
      toast.error("Please fill all required fields");
      return;
    }

    let remainingQuantity = quantity;
    const selectedLots = [];
    let currentLots = [...lots];

    while (remainingQuantity > 0 && currentLots.length > 0) {
      const lot = currentLots[0];
      if (!lot) {
        toast.error("No available lots for the selected quantity");
        return;
      }

      let qtyToTake = 0;
      if (
        currentItem.transactionType === "Waste" &&
        lot.damaged >= remainingQuantity
      ) {
        qtyToTake = remainingQuantity; // ตัดจาก damaged เท่าที่เหลือ
      } else if (currentItem.transactionType === "Waste" && lot.damaged > 0) {
        qtyToTake = Math.min(remainingQuantity, lot.damaged); // ตัดจาก damaged ก่อน
        remainingQuantity -= qtyToTake;
        if (remainingQuantity > 0 && lot.qtyOnHand >= remainingQuantity) {
          qtyToTake += remainingQuantity; // ตัดส่วนที่เหลือจาก qtyOnHand
          remainingQuantity = 0;
        }
      } else {
        qtyToTake = Math.min(remainingQuantity, lot.qtyOnHand); // ตัดจาก qtyOnHand ปกติ
      }

      if (qtyToTake <= 0) {
        toast.error("Quantity exceeds available stock or damaged stock");
        return;
      }

      const productId = lot.productId._id
        ? lot.productId._id.toString()
        : lot.productId.toString();
      const product = products.find((p) => p._id === productId);

      selectedLots.push({
        lotId: lot._id,
        quantity: qtyToTake,
        transactionType: currentItem.transactionType,
        productName: product?.name || "Unknown",
        productCode: product?.productCode || "N/A",
        lotCode: lot.lotCode,
        prodDate: lot.productionDate,
        expDate: lot.expDate,
        fromDamaged: currentItem.transactionType === "Waste" && lot.damaged > 0, // ระบุว่ามาจาก damaged
      });

      remainingQuantity -= qtyToTake;
      currentLots = currentLots.filter((l) => l._id.toString() !== lot._id);
    }

    if (remainingQuantity > 0) {
      toast.error("Insufficient stock across all lots");
      return;
    }

    setAddedItems((prevItems) => [...prevItems, ...selectedLots]);
    setSelectedProduct("");
    setCurrentItem((prev) => ({ ...prev, lotId: "", quantity: "" })); // ไม่รีเซ็ต transactionType
    fetchLots(""); // รีเซ็ต lots
  };

  const removeItem = (index) => {
    setAddedItems(addedItems.filter((_, i) => i !== index));
  };

  const handleIssue = async () => {
    if (addedItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmIssue = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);
    try {
      const transactionNumber = `TRX-${Date.now()}`; // Generate temporary transaction number
      const payload = {
        transactionNumber,
        lots: addedItems.map((item) => ({
          lotId: item.lotId,
          quantity: Number(item.quantity),
          fromDamaged: item.fromDamaged || false,
        })),
        type: addedItems[0].transactionType,
        warehouse: selectedWarehouse,
        destinationWarehouseId: "",
        note: "",
      };
      console.log("Issuing with payload:", JSON.stringify(payload, null, 2));
      const response = await axios.post(`${API_BASE_URL}/api/issue`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(response.data.message);
      console.log("Transaction response:", response.data);

      // Send Telegram notification
      const transactionData = {
        transactionNumber: response.data.transactionNumber || transactionNumber,
        warehouseId: selectedWarehouse,
        type: addedItems[0].transactionType,
        lots: addedItems,
        userId: user.id,
        status: "Active",
        createdAt: new Date(),
      };
      await sendTelegramNotification(transactionData);

      setAddedItems([]);
    } catch (error) {
      console.error("Issue error:", error.response?.data || error);
      toast.error(error.response?.data?.message || "Failed to issue stock");
    } finally {
      setIsLoading(false);
      navigate("/issue-history");
    }
  };

  const sendTelegramNotification = async (transaction) => {
    const totalQty = transaction.lots.reduce(
      (sum, lot) => sum + lot.quantity,
      0,
    );
    const warehouse =
      warehouses.find((w) => w._id === transaction.warehouseId)?.name ||
      "Unknown";
    const message = `
*Transaction Notification*
- Transaction #: ${transaction.transactionNumber}
- Warehouse: ${warehouse}
- Issue Type: ${transaction.type}
- Total Qty: ${totalQty}
- User: ${user.lastName || user.id}
- Status: ${transaction.status}
- Date/Time: ${format(new Date(transaction.createdAt), "dd/MM/yyyy, HH:mm:ss")}
    `.trim();

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/telegram/send`,
        {
          chat_id: "-4871143154",
          text: message,
          parse_mode: "Markdown",
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      console.log("Telegram notification response:", response.data);
    } catch (error) {
      console.error("Failed to send Telegram notification:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      toast.error(
        `Failed to send Telegram notification: ${error.response?.data?.description || error.message}`,
      );
    }
  };

  const cancelIssue = () => {
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
      // Show all products if input is empty
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
    setSelectedProduct(productId);
    const selected = filteredProducts.find((p) => p._id === productId);
    setProductSearch(
      selected ? `${selected.name} (${selected.productCode})` : "",
    );
    fetchLots(productId);
    setShowProductDropdown(false);
    if (productInputRef.current) productInputRef.current.blur();
  };

  return (
    <div className="mx-auto max-w-screen rounded-xl bg-gray-50 p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Issue Stock</h1>
          <p className="text-gray-600">
            Select warehouse, product type, and items to issue
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            onClick={handleIssue}
            disabled={isLoading || addedItems.length === 0}
            className={`rounded-lg px-4 py-2 text-sm font-medium shadow-sm ${isLoading ? "cursor-not-allowed bg-gray-300" : "bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"}`}
          >
            {isLoading ? "Processing..." : "Issue Stock"}
          </Button>
        </div>
      </div>

      {isLoading && !products.length ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-red-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-1 text-sm font-medium ${selectedCategory === "All" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700"} hover:bg-red-100`}
                  onClick={() => setSelectedCategory("All")}
                >
                  All Products
                </button>
                {categories.map((category) => (
                  <button
                    key={category._id}
                    type="button"
                    className={`rounded-lg border px-3 py-1 text-sm font-medium ${selectedCategory === category._id ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700"} hover:bg-red-100`}
                    onClick={() => setSelectedCategory(category._id)}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Warehouse
                </label>
                <Select.Root
                  value={selectedWarehouse}
                  onValueChange={setSelectedWarehouse}
                  disabled={user.role !== "admin" || isLoading}
                >
                  <Select.Trigger
                    className={`${user.role === "user" ? "bg-gray-200 text-gray-500" : "bg-white"} relative mt-1 block w-full appearance-none rounded-lg border border-gray-300 py-2.5 pr-10 pl-3 text-base transition-colors duration-200 hover:bg-gray-100 focus:border-red-500 focus:ring-red-500 focus:outline-none sm:text-sm`}
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
                            className="m-2 cursor-pointer rounded-sm px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 focus:bg-red-100 focus:outline-none"
                            disabled={
                              user.role !== "admin" && w._id !== user.warehouse
                            }
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
                  Product
                </label>
                <div className="relative">
                  <input
                    ref={productInputRef}
                    type="text"
                    placeholder="Search by product code or name..."
                    className="mb-2 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:ring-red-500 focus:outline-none sm:text-sm"
                    value={productSearch}
                    onChange={handleProductSearch}
                    onFocus={() => {
                      setShowProductDropdown(true);
                      setSearchResults(filteredProducts); // Show all products on focus
                    }}
                    onBlur={() =>
                      setTimeout(() => setShowProductDropdown(false), 150)
                    }
                    disabled={isLoading || !selectedWarehouse}
                    autoComplete="off"
                  />
                  {showProductDropdown && searchResults.length > 0 && (
                    <ul className="absolute z-10 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
                      {searchResults.map((product) => (
                        <li
                          key={product._id}
                          className={`cursor-pointer px-3 py-2 text-sm hover:bg-red-100 ${selectedProduct === product._id ? "bg-red-600 text-white" : "text-gray-700"}`}
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
                  Manual Lot Selection
                </label>
                <input
                  type="checkbox"
                  checked={isManualSelection}
                  onChange={(e) => {
                    setIsManualSelection(e.target.checked);
                    if (!e.target.checked && lots.length > 0) {
                      setCurrentItem((prev) => ({
                        ...prev,
                        lotId: lots[0]._id,
                      }));
                    } else {
                      setCurrentItem((prev) => ({ ...prev, lotId: "" }));
                    }
                  }}
                  className="mr-2 leading-tight"
                />
                <span>Select Lot Manually</span>
              </div>
              {!isManualSelection && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Selected Lot (FEFO)
                  </label>
                  <input
                    type="text"
                    value={
                      lots.length > 0
                        ? `${lots[0].lotCode} (Qty: ${lots[0].qtyOnHand}, Damaged: ${lots[0].damaged}, Exp: ${new Date(lots[0].expDate).toLocaleDateString()})`
                        : "No lots available"
                    }
                    readOnly
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2.5 shadow-sm"
                  />
                </div>
              )}
              {isManualSelection && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Lot
                  </label>
                  <Select.Root
                    value={currentItem.lotId}
                    onValueChange={(value) =>
                      setCurrentItem((prev) => ({ ...prev, lotId: value }))
                    }
                    disabled={isLoading || !selectedProduct}
                  >
                    <Select.Trigger className="mt-1 block w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pr-10 pl-3 text-base transition-colors duration-200 hover:bg-gray-100 focus:border-red-500 focus:ring-red-500 focus:outline-none sm:text-sm">
                      <Select.Value placeholder="Select lot" />
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
                            Lots
                          </Select.Label>
                          {lots.map((lot) => (
                            <Select.Item
                              key={lot._id}
                              value={lot._id}
                              className="m-2 cursor-pointer rounded-sm px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 focus:bg-red-100 focus:outline-none"
                            >
                              <Select.ItemText>
                                {lot.lotCode} (Qty: {lot.qtyOnHand}, Damaged:{" "}
                                {lot.damaged}, Exp:{" "}
                                {new Date(lot.expDate).toLocaleDateString()})
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
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Quantity
                </label>
                <input
                  type="number"
                  value={currentItem.quantity}
                  onChange={(e) =>
                    setCurrentItem((prev) => ({
                      ...prev,
                      quantity: e.target.value,
                    }))
                  }
                  placeholder="Enter quantity"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 shadow-sm focus:border-red-500 focus:ring-red-500 focus:outline-none sm:text-sm"
                  min="1"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Transaction Type
                </label>
                <Select.Root
                  value={currentItem.transactionType}
                  onValueChange={(value) => {
                    setCurrentItem((prev) => ({
                      ...prev,
                      transactionType: value,
                      lotId: "",
                    })); // รีเซ็ต lotId เมื่อเปลี่ยน type
                    fetchLots(selectedProduct); // อัปเดต lots ตาม transactionType
                  }}
                  disabled={isLoading}
                >
                  <Select.Trigger className="relative mt-1 block w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pr-10 pl-3 text-base transition-colors duration-200 hover:bg-gray-100 focus:border-red-500 focus:ring-red-500 focus:outline-none sm:text-sm">
                    <Select.Value placeholder="Select type" />
                    <Select.Icon className="absolute top-1/2 right-2 -translate-y-1/2 transform">
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
                          Types
                        </Select.Label>
                        {["Sale", "Waste", "Welfares", "Activities"].map(
                          (type) => (
                            <Select.Item
                              key={type}
                              value={type}
                              className="m-2 cursor-pointer rounded-sm px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 focus:bg-red-100 focus:outline-none"
                            >
                              <Select.ItemText>{type}</Select.ItemText>
                              <Select.ItemIndicator className="absolute right-2 inline-flex items-center">
                                <CheckIcon />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ),
                        )}
                      </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex h-6 items-center justify-center bg-gray-100 text-gray-600">
                      <ChevronDownIcon />
                    </Select.ScrollDownButton>
                  </Select.Content>
                </Select.Root>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-4">
              <Button
                onClick={addItem}
                disabled={
                  isLoading ||
                  !currentItem.quantity ||
                  !currentItem.transactionType ||
                  (isManualSelection && !currentItem.lotId)
                }
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none"
              >
                Add Item
              </Button>
            </div>
          </div>

          {addedItems.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-medium text-gray-900">
                Items to Issue ({addedItems.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        ProductCode
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        ProductName
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Lot Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Prod Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Exp Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {addedItems.map((item, index) => {
                      const lotInTable = addedItems.find(
                        (i) => i.lotCode === item.lotCode,
                      );
                      const lot =
                        lots.find((l) => l._id.toString() === item.lotId) ||
                        lotInTable;
                      console.log("Mapping item:", item, "Lot found:", lot);
                      const productId =
                        lot?.productId?._id?.toString() ||
                        lot?.productId?.toString();
                      const product = productId
                        ? products.find((p) => p._id === productId)
                        : null;
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                            {product?.productCode ||
                              lotInTable?.productCode ||
                              "N/A"}
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                            {product?.name ||
                              lotInTable?.productName ||
                              "Unknown"}
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                            {item.lotCode}
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                            {item.quantity}
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                            {lot
                              ? new Date(
                                  lot.prodDate || lot.productionDate,
                                ).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                            {lot
                              ? new Date(lot.expDate).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                            <button
                              onClick={() => removeItem(index)}
                              className="mr-4 text-red-600 hover:text-red-900"
                              disabled={isLoading}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Confirm Stock Issue</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <p>
                  <strong>Total Items:</strong> {addedItems.length}
                </p>
                <p>
                  <strong>Total Quantity:</strong>{" "}
                  {addedItems.reduce(
                    (sum, item) => sum + Number(item.quantity),
                    0,
                  )}
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={cancelIssue}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button onClick={confirmIssue} disabled={isLoading}>
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
      )}
    </div>
  );
};

export default IssueStock;
