import { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { FaPlus } from 'react-icons/fa';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

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
      toast.error('กรุณากรอกข้อมูลให้ครบก่อนเพิ่มล็อต');
      return;
    }
    const computedQuantity = Number(currentLot.boxCount) * Number(currentLot.qtyPerBox);
    setAddedLots([
      ...addedLots,
      {
        ...currentLot,
        quantity: computedQuantity,
        warehouse: selectedWarehouse,
        supplierId: selectedSupplier
      }
    ]);
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
      const response = await axios.post('http://localhost:3000/api/receive', payload, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(response.data.message);
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
      toast.error(error.response?.data?.message || 'Network Error');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = selectedCategory === 'All'
    ? products
    : products.filter(p => p.category && p.category._id === selectedCategory);

  if (!token) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Receive Stock</h2>
      {isLoading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs onSelect={index => setSelectedCategory(index === 0 ? 'All' : categories[index - 1]._id)}>
            <TabList className="flex space-x-4 border-b mb-4">
              <Tab className="px-4 py-2 cursor-pointer text-gray-600 hover:text-blue-500 border-b-2 border-transparent hover:border-blue-500">All</Tab>
              {categories.map(category => (
                <Tab key={category._id} className="px-4 py-2 cursor-pointer text-gray-600 hover:text-blue-500 border-b-2 border-transparent hover:border-blue-500">
                  {category.name}
                </Tab>
              ))}
            </TabList>
            {['All', ...categories.map(c => c._id)].map((_, index) => (
              <TabPanel key={index}></TabPanel>
            ))}
          </Tabs>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Warehouse</label>
              <select
                value={selectedWarehouse}
                onChange={e => {
                  setSelectedWarehouse(e.target.value);
                  setCurrentLot(prev => ({ ...prev, warehouse: e.target.value }));
                }}
                className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
              >
                {warehouses.map(w => (
                  <option key={w._id} value={w.name}>{w.name} ({w.warehouseCode})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Supplier</label>
              <select
                value={selectedSupplier}
                onChange={e => {
                  setSelectedSupplier(e.target.value);
                  setCurrentLot(prev => ({ ...prev, supplierId: e.target.value }));
                }}
                className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
              >
                {suppliers.map(s => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Product</label>
                <select
                  value={currentLot.productId}
                  onChange={e => updateCurrentLot('productId', e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                >
                  <option value="">Select Product</option>
                  {filteredProducts.map(product => (
                    <option key={product._id} value={product._id}>
                      {product.name} ({product.productCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Lot Code</label>
                <input
                  type="text"
                  value={currentLot.lotCode}
                  onChange={e => updateCurrentLot('lotCode', e.target.value)}
                  placeholder="Lot Code"
                  className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Quantity (คำนวณอัตโนมัติ)</label>
                <input
                  type="number"
                  value={currentLot.quantity}
                  placeholder="Quantity"
                  className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md py-2 px-3"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Box Count</label>
                <input
                  type="number"
                  value={currentLot.boxCount}
                  onChange={e => updateCurrentLot('boxCount', e.target.value)}
                  placeholder="Box Count"
                  className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Quantity per Box</label>
                <input
                  type="number"
                  value={currentLot.qtyPerBox}
                  onChange={e => updateCurrentLot('qtyPerBox', e.target.value)}
                  placeholder="Quantity per Box"
                  className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Production Date</label>
                <DatePicker
                  selected={currentLot.productionDate}
                  onChange={date => updateCurrentLot('productionDate', date)}
                  className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                  dateFormat="yyyy-MM-dd"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Expiration Date</label>
                <DatePicker
                  selected={currentLot.expDate}
                  onChange={date => updateCurrentLot('expDate', date)}
                  className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                  dateFormat="yyyy-MM-dd"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={addLot}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-500 hover:bg-blue-600"
                disabled={isLoading}
              >
                <FaPlus className="mr-2" />
                Add Stock
              </button>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Added Lots</h3>
            {addedLots.length > 0 && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Product</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Lot Code</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Quantity</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Box Count</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Qty per Box</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Production Date</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Expiration Date</th>
                    <th className="px-4 py-2 text-right text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {addedLots.map((lot, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {products.find(p => p._id === lot.productId)?.name || '-'} ({products.find(p => p._id === lot.productId)?.productCode || '-'})
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        <input
                          type="text"
                          value={lot.lotCode}
                          onChange={e => {
                            const updatedLots = [...addedLots];
                            updatedLots[index].lotCode = e.target.value;
                            setAddedLots(updatedLots);
                          }}
                          className="mt-1 block w-full border border-gray-300 rounded-md py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        <input
                          type="number"
                          value={lot.quantity}
                          disabled
                          className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md py-1 px-2"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        <input
                          type="number"
                          value={lot.boxCount}
                          onChange={e => {
                            const updatedLots = [...addedLots];
                            updatedLots[index].boxCount = Number(e.target.value);
                            updatedLots[index].quantity = updatedLots[index].boxCount * updatedLots[index].qtyPerBox;
                            setAddedLots(updatedLots);
                          }}
                          className="mt-1 block w-full border border-gray-300 rounded-md py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        <input
                          type="number"
                          value={lot.qtyPerBox}
                          onChange={e => {
                            const updatedLots = [...addedLots];
                            updatedLots[index].qtyPerBox = Number(e.target.value);
                            updatedLots[index].quantity = updatedLots[index].boxCount * updatedLots[index].qtyPerBox;
                            setAddedLots(updatedLots);
                          }}
                          className="mt-1 block w-full border border-gray-300 rounded-md py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        <DatePicker
                          selected={lot.productionDate}
                          onChange={date => {
                            const updatedLots = [...addedLots];
                            updatedLots[index].productionDate = date;
                            setAddedLots(updatedLots);
                          }}
                          className="mt-1 block w-full border border-gray-300 rounded-md py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                          dateFormat="yyyy-MM-dd"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        <DatePicker
                          selected={lot.expDate}
                          onChange={date => {
                            const updatedLots = [...addedLots];
                            updatedLots[index].expDate = date;
                            setAddedLots(updatedLots);
                          }}
                          className="mt-1 block w-full border border-gray-300 rounded-md py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                          dateFormat="yyyy-MM-dd"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLot(index)}
                          className="text-red-500 hover:text-red-700 mr-2"
                          disabled={isLoading}
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => editLot(index)}
                          className="text-blue-500 hover:text-blue-700"
                          disabled={isLoading}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${isLoading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
              disabled={isLoading}
            >
              Receive Stock
            </button>
          </div>
        </form>
      )}
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default ReceiveStock;