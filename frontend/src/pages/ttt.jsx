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

const ReceiveStock = () => {
  // ... existing state declarations ...

  // ... existing useEffect and other functions ...

  return (
    <div className="p-6 max-w-screen mx-auto bg-gray-50 rounded-xl">
      {/* ... existing header ... */}

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
                  <Tab className="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer ui-selected:bg-white ui-selected:shadow ui-selected:text-blue-600 text-gray-600 hover:bg-gray-200 hover:text-blue-500 ui-selected:hover:bg-white">
                    All Products
                  </Tab>
                  {categories.map(category => (
                    <Tab
                      key={category._id}
                      className="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer ui-selected:bg-white ui-selected:shadow ui-selected:text-blue-600 text-gray-600 hover:bg-gray-200 hover:text-blue-500 ui-selected:hover:bg-white"
                    >
                      {category.name}
                    </Tab>
                  ))}
                </TabList>
                {/* ... existing TabPanels ... */}
              </Tabs>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Warehouse Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
                <select
                  value={selectedWarehouse}
                  onChange={e => {
                    setSelectedWarehouse(e.target.value);
                    setCurrentLot(prev => ({ ...prev, warehouse: e.target.value }));
                  }}
                  className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  disabled={user.role !== 'admin'}
                >
                  {warehouses.map(w => (
                    <option key={w._id} value={w.name}>{w.name} ({w.warehouseCode})</option>
                  ))}
                </select>
              </div>
              
              {/* Supplier Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <select
                  value={selectedSupplier}
                  onChange={e => {
                    setSelectedSupplier(e.target.value);
                    setCurrentLot(prev => ({ ...prev, supplierId: e.target.value }));
                  }}
                  className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  {suppliers.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Stock Item</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Product Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product <span className="text-red-500">*</span></label>
                  <select
                    value={currentLot.productId}
                    onChange={e => updateCurrentLot('productId', e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg hover:bg-gray-200 transition-colors duration-200"
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

                {/* ... other form elements ... */}
              </div>

              {/* ... add button ... */}
            </div>
          </div>

          {/* ... existing table for added lots ... */}
        </form>
      )}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
    </div>
  );
};

export default ReceiveStock;