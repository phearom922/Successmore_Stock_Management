import { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaCalendarAlt } from 'react-icons/fa';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import * as Select from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';

const ReceiveStock = () => {
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [currentLot, setCurrentLot] = useState({
    productId: '',
    lotCode: '',
    quantity: '',
    boxCount: '',
    qtyPerBox: '',
    productionDate: null,
    expDate: null,
    warehouse: '',
    supplierId: ''
  });
  const [addedLots, setAddedLots] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const user = token ? JSON.parse(atob(token.split('.')[1])) : {};

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
    } catch {
      localStorage.removeItem('token');
      toast.error('Invalid token, please login again');
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [productsRes, categoriesRes, warehousesRes, suppliersRes] = await Promise.all([
          axios.get('http://localhost:3000/api/products', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:3000/api/categories', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:3000/api/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:3000/api/suppliers', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setProducts(productsRes.data || []);
        setCategories(categoriesRes.data || []);
        setWarehouses(warehousesRes.data || []);
        setSuppliers(suppliersRes.data || []);

        const defaultWarehouse = user.role !== 'admin' && user.warehouse && warehousesRes.data.some(w => w.name === user.warehouse)
          ? user.warehouse
          : warehousesRes.data[0]?.name || '';
        const defaultSupplier = suppliersRes.data[0]?._id || '';

        setSelectedWarehouse(defaultWarehouse);
        setSelectedSupplier(defaultSupplier);
        setCurrentLot(prev => ({
          ...prev,
          warehouse: defaultWarehouse,
          supplierId: defaultSupplier
        }));
      } catch (error) {
        console.error('Error fetching data:', error.response || error);
        if (error.response?.status === 401) {
          toast.error('Session expired, please login again');
          navigate('/login');
        } else {
          toast.error(error.response?.data?.message || 'Failed to load data');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [token, navigate, user.role, user.warehouse]);

  const updateCurrentLot = (field, value) => {
    const updatedLot = { ...currentLot, [field]: value };
    if (field === 'boxCount' || field === 'qtyPerBox') {
      updatedLot.quantity = Number(updatedLot.boxCount) * Number(updatedLot.qtyPerBox) || '';
    }
    setCurrentLot(updatedLot);
  };

  const addLot = () => {
    if (!currentLot.productId || !currentLot.lotCode || !currentLot.boxCount || !currentLot.qtyPerBox || !currentLot.productionDate || !currentLot.expDate) {
      toast.error('Please fill all required fields before adding a lot');
      return;
    }
    if (Number(currentLot.boxCount) <= 0 || Number(currentLot.qtyPerBox) <= 0) {
      toast.error('Box count and quantity per box must be positive numbers');
      return;
    }
    if (new Date(currentLot.expDate) <= new Date(currentLot.productionDate)) {
      toast.error('Expiration date must be after production date');
      return;
    }

    const computedQuantity = Number(currentLot.boxCount) * Number(currentLot.qtyPerBox);
    const newLot = {
      ...currentLot,
      quantity: computedQuantity,
      warehouse: selectedWarehouse,
      supplierId: selectedSupplier
    };

    // ตรวจสอบและอัปเดตหรือเพิ่มรายการ
    setAddedLots(prevLots => {
      const existingIndex = prevLots.findIndex(lot => lot.lotCode === currentLot.lotCode);
      if (existingIndex !== -1) {
        // อัปเดตข้อมูลในตำแหน่งเดิม
        const updatedLots = [...prevLots];
        updatedLots[existingIndex] = newLot;
        return updatedLots;
      } else {
        // เพิ่มรายการใหม่
        return [...prevLots, newLot];
      }
    });

    // รีเซ็ต currentLot
    setCurrentLot({
      productId: '',
      lotCode: '',
      quantity: '',
      boxCount: '',
      qtyPerBox: '',
      productionDate: null,
      expDate: null,
      warehouse: selectedWarehouse,
      supplierId: selectedSupplier
    });
  };

  const removeLot = index => {
    setAddedLots(addedLots.filter((_, i) => i !== index));
  };

  const editLot = index => {
    const lotToEdit = addedLots[index];
    setCurrentLot(lotToEdit);
    removeLot(index);
  };

// ... (โค้ดเดิมจนถึง handleSubmit)

const handleSubmit = async e => {
  e.preventDefault();
  if (!token) {
    toast.error('Please login first');
    return;
  }
  const warehouseValid = warehouses.some(w => w.name === selectedWarehouse);
  const supplierValid = suppliers.some(s => s._id === selectedSupplier);
  if (!warehouseValid || !supplierValid || addedLots.length === 0) {
    toast.error(`Please ensure ${!warehouseValid ? 'Warehouse' : ''}${!warehouseValid && !supplierValid ? ' and ' : ''}${!supplierValid ? 'Supplier' : ''} are valid and add at least one lot`);
    return;
  }

  // Validate all lots before submission
  for (const lot of addedLots) {
    if (!lot.productId || !lot.lotCode || !lot.quantity || !lot.boxCount || !lot.qtyPerBox || !lot.productionDate || !lot.expDate) {
      toast.error('All fields in added lots must be filled');
      return;
    }
    if (lot.quantity <= 0 || lot.boxCount <= 0 || lot.qtyPerBox <= 0) {
      toast.error('Quantity, box count, and quantity per box must be positive');
      return;
    }
    if (new Date(lot.expDate) <= new Date(lot.productionDate)) {
      toast.error('Expiration date must be after production date');
      return;
    }
    if (lot.quantity !== lot.boxCount * lot.qtyPerBox) {
      toast.error('Quantity must equal Box Count * Quantity per Box');
      return;
    }
  }

  setIsLoading(true);
  try {
    const payload = {
      lots: addedLots.map(lot => ({
        productId: lot.productId,
        lotCode: lot.lotCode,
        quantity: Number(lot.quantity),
        boxCount: Number(lot.boxCount),
        qtyPerBox: Number(lot.qtyPerBox),
        productionDate: lot.productionDate.toISOString(),
        expDate: lot.expDate.toISOString(),
        warehouse: lot.warehouse,
        supplierId: lot.supplierId
      }))
    };
    console.log('Payload being sent:', JSON.stringify(payload, null, 2)); // ดีบั๊ก payload
    const response = await axios.post('http://localhost:3000/api/receive', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    toast.success(response.data.message || 'Stock received successfully!');
    setAddedLots([]);
    setCurrentLot({
      productId: '',
      lotCode: '',
      quantity: '',
      boxCount: '',
      qtyPerBox: '',
      productionDate: null,
      expDate: null,
      warehouse: selectedWarehouse,
      supplierId: selectedSupplier
    });
  } catch (error) {
    console.error('Error receiving stock:', error.response || error);
    const errorMessage = error.response?.data?.message || 'Failed to receive stock. Please try again.';
    if (typeof toast === 'function' && toast.error) toast.error(errorMessage); // ตรวจสอบ toast และ method
    if (error.response?.status === 401) {
      navigate('/login');
    }
  } finally {
    setIsLoading(false);
  }
};

// ... (โค้ดเดิมต่อจากนี้)

  const filteredProducts = selectedCategory === 'All'
    ? products
    : products.filter(p => p.category && p.category._id === selectedCategory);

  if (!token) return null;

  return (
    <div className="p-6 max-w-screen mx-auto bg-gray-50 rounded-xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Receive Stock</h2>
        <div className="flex space-x-3">
          <button
            type="submit"
            onClick={handleSubmit}
            className={`inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white ${isLoading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'}`}
            disabled={isLoading || addedLots.length === 0}
          >
            {isLoading ? 'Processing...' : 'Receive Stock'}
          </button>
        </div>
      </div>

      {isLoading && !products.length ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="mb-6">
              <Tabs onSelect={index => setSelectedCategory(index === 0 ? 'All' : categories[index - 1]._id)}>
                <TabList className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                  <Tab className="px-4 py-2 text-sm font-medium rounded-md cursor-pointer ui-selected:bg-white ui-selected:shadow ui-selected:text-blue-600 text-gray-600 hover:text-blue-500">
                    All Products
                  </Tab>
                  {categories.map(category => (
                    <Tab
                      key={category._id}
                      className="px-4 py-2 text-sm font-medium rounded-md cursor-pointer ui-selected:bg-white ui-selected:shadow ui-selected:text-blue-600 text-gray-600 hover:text-blue-500"
                    >
                      {category.name}
                    </Tab>
                  ))}
                </TabList>
                {['All', ...categories.map(c => c._id)].map((_, index) => (
                  <TabPanel key={index}></TabPanel>
                ))}
              </Tabs>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div >
                <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
                <Select.Root
                  value={selectedWarehouse}
                  onValueChange={(value) => {
                    setSelectedWarehouse(value);
                    setCurrentLot(prev => ({ ...prev, warehouse: value }));
                  }}
                  disabled={user.role !== 'admin' || isLoading}
                >
                  <Select.Trigger
                    className="mt-1 block w-full relative pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg appearance-none bg-white hover:bg-gray-100 transition-colors duration-200"
                  >
                    <Select.Value placeholder="Select warehouse" />
                    <Select.Icon className="absolute right-3 top-1/2  transform -translate-y-1/2">
                      <ChevronDownIcon />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Content className="bg-white border border-gray-300 rounded-lg shadow-lg mt-1">
                    <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-gray-100 text-gray-600">
                      <ChevronUpIcon />
                    </Select.ScrollUpButton>
                    <Select.Viewport>
                      <Select.Group>
                        <Select.Label className="px-3 py-1.5 text-sm text-gray-500">Warehouses</Select.Label>
                        {warehouses.map(w => (
                          <Select.Item
                            key={w._id}
                            value={w.name}
                            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 cursor-pointer focus:bg-blue-100 m-2 rounded-sm focus:outline-none"
                          >
                            <Select.ItemText>{w.name} ({w.warehouseCode})</Select.ItemText>
                            <Select.ItemIndicator className="absolute right-2 inline-flex items-center">
                              <CheckIcon />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-gray-100 text-gray-600">
                      <ChevronDownIcon />
                    </Select.ScrollDownButton>
                  </Select.Content>
                </Select.Root>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <Select.Root
                  value={selectedSupplier}
                  onValueChange={(value) => {
                    setSelectedSupplier(value);
                    setCurrentLot(prev => ({ ...prev, supplierId: value }));
                  }}
                  disabled={isLoading}
                >
                  <Select.Trigger
                    className="mt-1 block relative w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg appearance-none bg-white hover:bg-gray-100 transition-colors duration-200"
                  >
                    <Select.Value placeholder="Select supplier" />
                    <Select.Icon className="absolute right-3 top-1/2  transform -translate-y-1/2">
                      <ChevronDownIcon />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Content className="bg-white border border-gray-300 rounded-lg shadow-lg mt-1">
                    <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-gray-100 text-gray-600">
                      <ChevronUpIcon />
                    </Select.ScrollUpButton>
                    <Select.Viewport>
                      <Select.Group>
                        <Select.Label className="px-3 py-1.5 text-sm text-gray-500">Suppliers</Select.Label>
                        {suppliers.map(s => (
                          <Select.Item
                            key={s._id}
                            value={s._id}
                            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 cursor-pointer focus:bg-blue-100 m-2 rounded-sm focus:outline-none"
                          >
                            <Select.ItemText>{s.name}</Select.ItemText>
                            <Select.ItemIndicator className="absolute right-2 inline-flex items-center">
                              <CheckIcon />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-gray-100 text-gray-600">
                      <ChevronDownIcon />
                    </Select.ScrollDownButton>
                  </Select.Content>
                </Select.Root>
              </div>
            </div>

            <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Stock Item</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Select.Root
                      value={currentLot.productId}
                      onValueChange={(value) => updateCurrentLot('productId', value)}
                      disabled={isLoading}
                    >
                      <Select.Trigger
                        className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg appearance-none bg-white hover:bg-gray-100 transition-colors duration-200"
                      >
                        <Select.Value placeholder="Select product" />
                        <Select.Icon className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <ChevronDownIcon />
                        </Select.Icon>
                      </Select.Trigger>
                      <Select.Content className="bg-white border border-gray-300 rounded-lg shadow-lg mt-1">
                        <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-gray-100 text-gray-600">
                          <ChevronUpIcon />
                        </Select.ScrollUpButton>
                        <Select.Viewport>
                          <Select.Group>
                            <Select.Label className="px-3 py-1.5 text-sm text-gray-500">Products</Select.Label>
                            {filteredProducts.map(product => (
                              <Select.Item
                                key={product._id}
                                value={product._id}
                                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 cursor-pointer focus:bg-blue-100 m-2 rounded-sm focus:outline-none"
                              >
                                <Select.ItemText>{product.name} ({product.productCode})</Select.ItemText>
                                <Select.ItemIndicator className="absolute right-2 inline-flex items-center">
                                  <CheckIcon />
                                </Select.ItemIndicator>
                              </Select.Item>
                            ))}
                          </Select.Group>
                        </Select.Viewport>
                        <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-gray-100 text-gray-600">
                          <ChevronDownIcon />
                        </Select.ScrollDownButton>
                      </Select.Content>
                    </Select.Root>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lot Code <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={currentLot.lotCode}
                    onChange={e => updateCurrentLot('lotCode', e.target.value)}
                    placeholder="Enter lot code"
                    className="mt-1 block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Box Count <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={currentLot.boxCount}
                    onChange={e => updateCurrentLot('boxCount', e.target.value)}
                    placeholder="Enter box count"
                    className="mt-1 block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    disabled={isLoading}
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity per Box <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={currentLot.qtyPerBox}
                    onChange={e => updateCurrentLot('qtyPerBox', e.target.value)}
                    placeholder="Enter quantity per box"
                    className="mt-1 block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    disabled={isLoading}
                    min="1"
                  />
                </div>

                <div className='mt-1'>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (auto-calculated)</label>
                  <input
                    type="number"
                    value={currentLot.quantity}
                    placeholder="Auto-calculated"
                    className="mt-1 block w-full px-3 py-2.5 border border-gray-300 bg-gray-100 rounded-lg shadow-sm sm:text-sm"
                    disabled
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Production Date <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <DatePicker
                        selected={currentLot.productionDate}
                        onChange={date => updateCurrentLot('productionDate', date)}
                        className="mt-1 block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        disabled={isLoading}
                        dateFormat="dd-MM-yyyy"
                        placeholderText="Select production date"
                        minDate={new Date(new Date().setFullYear(new Date().getFullYear() - 5))}
                        maxDate={new Date()}
                        showYearDropdown
                        scrollableYearDropdown
                        yearDropdownItemNumber={15}
                        showMonthDropdown
                        dropdownMode="select"
                      />
                      <FaCalendarAlt className="absolute left-3 top-3.5 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <DatePicker
                        selected={currentLot.expDate}
                        onChange={date => updateCurrentLot('expDate', date)}
                        className="mt-1 block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                      <FaCalendarAlt className="absolute left-3 top-3.5 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={addLot}
                  className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={isLoading || !currentLot.productId || !currentLot.lotCode || !currentLot.boxCount || !currentLot.qtyPerBox || !currentLot.productionDate || !currentLot.expDate}
                >
                  <FaPlus className="mr-2" />
                  Add Stock Item
                </button>
              </div>
            </div>
          </div>

          {addedLots.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Stock Items to Receive ({addedLots.length})</h3>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot Code</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boxes</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty/Box</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prod Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exp Date</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {addedLots.map((lot, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {products.find(p => p._id === lot.productId)?.name || '-'}
                          <span className="block text-xs text-gray-500">{products.find(p => p._id === lot.productId)?.productCode || '-'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="text"
                            value={lot.lotCode}
                            onChange={e => {
                              const updatedLots = [...addedLots];
                              updatedLots[index].lotCode = e.target.value;
                              setAddedLots(updatedLots);
                            }}
                            className="block w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            value={lot.quantity}
                            disabled
                            className="block w-full px-3 py-1.5 border border-gray-300 bg-gray-100 rounded-md shadow-sm sm:text-sm"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            value={lot.boxCount}
                            onChange={e => {
                              const updatedLots = [...addedLots];
                              updatedLots[index].boxCount = Number(e.target.value);
                              updatedLots[index].quantity = updatedLots[index].boxCount * updatedLots[index].qtyPerBox;
                              setAddedLots(updatedLots);
                            }}
                            className="block w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            min="1"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            value={lot.qtyPerBox}
                            onChange={e => {
                              const updatedLots = [...addedLots];
                              updatedLots[index].qtyPerBox = Number(e.target.value);
                              updatedLots[index].quantity = updatedLots[index].boxCount * updatedLots[index].qtyPerBox;
                              setAddedLots(updatedLots);
                            }}
                            className="block w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            min="1"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <DatePicker
                            selected={lot.productionDate}
                            onChange={date => {
                              const updatedLots = [...addedLots];
                              updatedLots[index].productionDate = date;
                              setAddedLots(updatedLots);
                            }}
                            className="block w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            dateFormat="dd-MM-yyyy"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <DatePicker
                            selected={lot.expDate}
                            onChange={date => {
                              const updatedLots = [...addedLots];
                              updatedLots[index].expDate = date;
                              setAddedLots(updatedLots);
                            }}
                            className="block w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            dateFormat="dd-MM-yyyy"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            type="button"
                            onClick={() => removeLot(index)}
                            className="text-red-600 hover:text-red-900 mr-4"
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
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
    </div>
  );
};

export default ReceiveStock;