import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import * as Select from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
} from "@/components/ui/table";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { startOfDay, endOfDay, format } from 'date-fns';
import jsPDF from 'jspdf';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

const TransferOrder = () => {
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [sourceWarehouse, setSourceWarehouse] = useState('');
    const [destinationWarehouse, setDestinationWarehouse] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedProduct, setSelectedProduct] = useState('');
    const [lots, setLots] = useState([]);
    const [currentItem, setCurrentItem] = useState({
        lotId: '',
        quantity: ''
    });
    const [addedItems, setAddedItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isManualSelection, setIsManualSelection] = useState(false);
    const [transferHistory, setTransferHistory] = useState([]);
    const [filters, setFilters] = useState({
        status: 'Pending',
        warehouse: 'all',
        type: 'all',
        startDate: startOfDay(new Date()),
        endDate: endOfDay(new Date()),
        tab: 'in' // เริ่มต้นที่ Transaction In
    });
    const token = localStorage.getItem('token');
    const navigate = useNavigate();
    const user = token ? JSON.parse(atob(token.split('.')[1])) : {};
    const userWarehouseId = user.warehouse?.toString() || (user.role === 'admin' ? filters.warehouse : null);
    const API_BASE_URL = 'http://localhost:3000';

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        fetchData();
        fetchTransferHistory();
    }, [token, navigate, filters]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [warehousesRes, productsRes, categoriesRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/warehouses`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_BASE_URL}/api/products`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_BASE_URL}/api/categories`, { headers: { Authorization: `Bearer ${token}` } }),
            ]);
            setWarehouses(warehousesRes.data);
            setProducts(productsRes.data.map(p => ({ ...p, _id: p._id.toString() })));
            setCategories(categoriesRes.data);

            const defaultWarehouse = user.role !== 'admin' ? user.warehouse : warehousesRes.data[0]?._id;
            if (!defaultWarehouse) {
                toast.error('No warehouse assigned or available');
                return;
            }
            setSourceWarehouse(defaultWarehouse);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load data');
            if (error.response?.status === 401) navigate('/login');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLots = async (productId) => {
        if (!productId || !sourceWarehouse) return;
        try {
            const { data } = await axios.get(`${API_BASE_URL}/api/lots`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { productId, warehouse: sourceWarehouse }
            });
            const filteredLots = data.filter(lot => lot.warehouse.toString() === sourceWarehouse && lot.qtyOnHand > 0);
            const sortedLots = filteredLots.sort((a, b) => new Date(a.expDate) - new Date(b.expDate));
            setLots(sortedLots);
            if (!isManualSelection && sortedLots.length > 0) {
                setCurrentItem(prev => ({ ...prev, lotId: sortedLots[0]._id }));
            }
        } catch (error) {
            toast.error('Failed to load lots');
        }
    };

    const fetchTransferHistory = async () => {
        try {
            console.log('Fetching transfer history with filters:', filters); // Debug
            const params = {
                status: filters.status !== 'all' ? filters.status : undefined,
                warehouse: filters.warehouse !== 'all' ? filters.warehouse : undefined,
                startDate: filters.startDate.toISOString(),
                endDate: filters.endDate.toISOString()
            };
            const { data } = await axios.get(`${API_BASE_URL}/api/transfer-history`, {
                headers: { Authorization: `Bearer ${token}` },
                params
            });
            console.log('Transfer history data:', data); // Debug
            setTransferHistory(data);
        } catch (error) {
            toast.error('Failed to load transfer history');
            console.error('Fetch transfer history error:', error.response?.data || error);
        }
    };

    const addItem = () => {
        const quantity = Number(currentItem.quantity);
        if (!quantity) {
            toast.error('Please fill all required fields');
            return;
        }

        let remainingQuantity = quantity;
        const selectedLots = [];
        let currentLots = [...lots];

        while (remainingQuantity > 0 && currentLots.length > 0) {
            const lot = currentLots[0];
            if (!lot) {
                toast.error('No available lots for the selected quantity');
                return;
            }

            const qtyToTake = Math.min(remainingQuantity, lot.qtyOnHand);
            if (qtyToTake <= 0) {
                toast.error('Quantity exceeds available stock');
                return;
            }

            const productId = lot.productId._id ? lot.productId._id.toString() : lot.productId.toString();
            const product = products.find(p => p._id === productId);

            selectedLots.push({
                lotId: lot._id,
                quantity: qtyToTake,
                productName: product?.name || 'Unknown',
                productCode: product?.productCode || 'N/A',
                lotCode: lot.lotCode,
                prodDate: lot.productionDate,
                expDate: lot.expDate
            });

            remainingQuantity -= qtyToTake;
            currentLots = currentLots.filter(l => l._id.toString() !== lot._id);
        }

        if (remainingQuantity > 0) {
            toast.error('Insufficient stock across all lots');
            return;
        }

        setAddedItems(prevItems => [...prevItems, ...selectedLots]);
        setSelectedProduct('');
        setCurrentItem({ lotId: '', quantity: '' });
        fetchLots(''); // รีเซ็ต lots
    };

    const removeItem = (index) => {
        setAddedItems(addedItems.filter((_, i) => i !== index));
    };

    const handleTransfer = async () => {
        if (addedItems.length === 0 || !destinationWarehouse || sourceWarehouse === destinationWarehouse) {
            toast.error('Please add items and select a different destination warehouse');
            return;
        }
        const totalItems = addedItems.length;
        const totalQuantity = addedItems.reduce((sum, item) => sum + Number(item.quantity), 0);
        setShowConfirmModal(true);
    };

    const confirmTransfer = async () => {
        setShowConfirmModal(false);
        setIsLoading(true);
        try {
            const payload = {
                lots: addedItems.map(item => ({ lotId: item.lotId, quantity: Number(item.quantity) })),
                sourceWarehouseId: sourceWarehouse,
                destinationWarehouseId: destinationWarehouse,
                note: ''
            };
            console.log('Transferring with payload:', JSON.stringify(payload, null, 2));
            const response = await axios.post(`${API_BASE_URL}/api/transfer`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(response.data.message);
            console.log('Transfer Number:', response.data.transferNumber);
            setAddedItems([]);
            fetchTransferHistory(); // อัปเดตประวัติหลังโอน
        } catch (error) {
            console.error('Transfer error:', error.response?.data || error);
            toast.error(error.response?.data?.message || 'Failed to transfer stock');
        } finally {
            setIsLoading(false);
        }
    };

    const cancelTransfer = () => {
        setShowConfirmModal(false);
    };

    const handleConfirmTransfer = async (transferId) => {
        if (window.confirm('Are you sure you want to confirm this transfer?')) {
            try {
                const response = await axios.patch(`${API_BASE_URL}/api/transfer/${transferId}/confirm`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                toast.success(response.data.message);
                fetchTransferHistory();
            } catch (error) {
                toast.error('Failed to confirm transfer');
                console.error('Confirm error:', error.response?.data);
            }
        }
    };

    const handleRejectTransfer = async (transferId) => {
        if (window.confirm('Are you sure you want to reject this transfer?')) {
            try {
                const response = await axios.patch(`${API_BASE_URL}/api/transfer/${transferId}/reject`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                toast.success(response.data.message);
                fetchTransferHistory();
            } catch (error) {
                toast.error('Failed to reject transfer');
                console.error('Reject error:', error.response?.data);
            }
        }
    };

    const generatePDF = (transfer) => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Transfer Order Request', 80, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.text('Transfer Details:', 20, 40);
        doc.text(`Transfer #: ${transfer.transferNumber || 'N/A'}`, 20, 50);
        doc.text(`Date: ${format(new Date(transfer.createdAt), 'dd/MM/yyyy')}`, 20, 60);
        doc.text(`Source Warehouse: ${transfer.sourceWarehouseId?.name || 'N/A'}`, 20, 70);
        doc.text(`Destination Warehouse: ${transfer.destinationWarehouseId?.name || 'N/A'}`, 20, 80);

        const startY = 100;
        doc.setFontSize(12);
        doc.text('Items List:', 20, startY);
        doc.setFontSize(10);
        doc.text('No.', 20, startY + 10);
        doc.text('Product Code', 30, startY + 10);
        doc.text('Product Name', 60, startY + 10);
        doc.text('Lot Code', 100, startY + 10);
        doc.text('Quantity', 130, startY + 10);
        doc.text('Production Date', 150, startY + 10);
        doc.text('Expiration Date', 180, startY + 10);

        let y = startY + 20;
        transfer.lots.forEach((lot, index) => {
            const product = lot.lotId?.productId || {};
            doc.text(`${index + 1}.`, 20, y);
            doc.text(lot.lotId?.productId?.productCode || product.productCode || 'N/A', 30, y);
            doc.text(lot.lotId?.productId?.name || product.name || 'N/A', 60, y);
            doc.text(lot.lotId?.lotCode || 'N/A', 100, y);
            doc.text(String(lot.quantity), 130, y);
            doc.text(lot.lotId?.productionDate ? format(new Date(lot.lotId.productionDate), 'dd/MM/yyyy') : 'N/A', 150, y);
            doc.text(lot.lotId?.expDate ? format(new Date(lot.lotId.expDate), 'dd/MM/yyyy') : 'N/A', 180, y);
            y += 10;
        });

        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
    };

    const filteredProducts = selectedCategory === 'All'
        ? products
        : products.filter(p => p.category && p.category._id === selectedCategory);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'Confirmed':
                return 'bg-green-100 text-green-800';
            case 'Rejected':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };




    return (
        <div className="p-6 max-w-screen-2xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Stock Transfer</h1>
                    <p className="text-gray-600 mt-1">Manage inventory transfers between warehouses</p>
                </div>
                <div className="flex space-x-3">
                    <Button
                        onClick={handleTransfer}
                        disabled={isLoading || addedItems.length === 0}
                        className="min-w-[150px]"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4z" clipRule="evenodd" />
                                </svg>
                                Transfer Stock
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {isLoading && !products.length ? (
                <div className="space-y-8">
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[...Array(4)].map((_, i) => (
                            <Skeleton key={i} className="h-64 rounded-xl" />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Create New Transfer</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="category">Product Category</Label>
                                        <Select.Root value={selectedCategory} onValueChange={setSelectedCategory}>
                                            <Select.Trigger className="w-full mt-1">
                                                <Select.Value placeholder="Select category" />
                                                <Select.Icon>
                                                    <ChevronDownIcon className="h-4 w-4 opacity-50" />
                                                </Select.Icon>
                                            </Select.Trigger>
                                            <Select.Content className="z-50">
                                                <Select.ScrollUpButton>
                                                    <ChevronUpIcon />
                                                </Select.ScrollUpButton>
                                                <Select.Viewport>
                                                    <Select.Group>
                                                        <Select.Label className="px-3 py-1.5 text-sm text-gray-500">Categories</Select.Label>
                                                        <Select.Item value="All" className="SelectItem">
                                                            <Select.ItemText>All Products</Select.ItemText>
                                                            <Select.ItemIndicator>
                                                                <CheckIcon />
                                                            </Select.ItemIndicator>
                                                        </Select.Item>
                                                        {categories.map(category => (
                                                            <Select.Item key={category._id} value={category._id} className="SelectItem">
                                                                <Select.ItemText>{category.name}</Select.ItemText>
                                                                <Select.ItemIndicator>
                                                                    <CheckIcon />
                                                                </Select.ItemIndicator>
                                                            </Select.Item>
                                                        ))}
                                                    </Select.Group>
                                                </Select.Viewport>
                                                <Select.ScrollDownButton>
                                                    <ChevronDownIcon />
                                                </Select.ScrollDownButton>
                                            </Select.Content>
                                        </Select.Root>
                                    </div>

                                    <div>
                                        <Label htmlFor="product">Product</Label>
                                        <Select.Root
                                            value={selectedProduct}
                                            onValueChange={(value) => {
                                                setSelectedProduct(value);
                                                fetchLots(value);
                                            }}
                                            disabled={isLoading || !sourceWarehouse}
                                        >
                                            <Select.Trigger className="w-full mt-1">
                                                <Select.Value placeholder="Select product" />
                                                <Select.Icon>
                                                    <ChevronDownIcon className="h-4 w-4 opacity-50" />
                                                </Select.Icon>
                                            </Select.Trigger>
                                            <Select.Content className="z-50">
                                                <Select.ScrollUpButton>
                                                    <ChevronUpIcon />
                                                </Select.ScrollUpButton>
                                                <Select.Viewport>
                                                    <Select.Group>
                                                        <Select.Label className="px-3 py-1.5 text-sm text-gray-500">Products</Select.Label>
                                                        {filteredProducts.map(product => (
                                                            <Select.Item key={product._id} value={product._id} className="SelectItem">
                                                                <Select.ItemText>
                                                                    <div className="flex items-center">
                                                                        <span className="font-medium">{product.name}</span>
                                                                        <span className="text-gray-500 ml-2">({product.productCode})</span>
                                                                    </div>
                                                                </Select.ItemText>
                                                                <Select.ItemIndicator>
                                                                    <CheckIcon />
                                                                </Select.ItemIndicator>
                                                            </Select.Item>
                                                        ))}
                                                    </Select.Group>
                                                </Select.Viewport>
                                                <Select.ScrollDownButton>
                                                    <ChevronDownIcon />
                                                </Select.ScrollDownButton>
                                            </Select.Content>
                                        </Select.Root>
                                    </div>

                                    <div className="flex items-center space-x-2 pt-2">
                                        <input
                                            type="checkbox"
                                            id="manualSelection"
                                            checked={isManualSelection}
                                            onChange={(e) => {
                                                setIsManualSelection(e.target.checked);
                                                if (!e.target.checked && lots.length > 0) {
                                                    setCurrentItem(prev => ({ ...prev, lotId: lots[0]._id }));
                                                } else {
                                                    setCurrentItem(prev => ({ ...prev, lotId: '' }));
                                                }
                                            }}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <Label htmlFor="manualSelection">Manual Lot Selection</Label>
                                    </div>

                                    {!isManualSelection && lots.length > 0 && (
                                        <div>
                                            <Label>Selected Lot (FEFO)</Label>
                                            <div className="mt-1 p-3 border rounded-md bg-gray-50">
                                                <div className="flex justify-between">
                                                    <span className="font-medium">{lots[0].lotCode}</span>
                                                    <span className="text-gray-600">Qty: {lots[0].qtyOnHand}</span>
                                                </div>
                                                <div className="text-sm text-gray-500 mt-1">
                                                    Exp: {new Date(lots[0].expDate).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {isManualSelection && (
                                        <div>
                                            <Label htmlFor="lot">Lot</Label>
                                            <Select.Root
                                                value={currentItem.lotId}
                                                onValueChange={(value) => setCurrentItem(prev => ({ ...prev, lotId: value }))}
                                                disabled={isLoading || !selectedProduct}
                                            >
                                                <Select.Trigger className="w-full mt-1">
                                                    <Select.Value placeholder="Select lot" />
                                                    <Select.Icon>
                                                        <ChevronDownIcon className="h-4 w-4 opacity-50" />
                                                    </Select.Icon>
                                                </Select.Trigger>
                                                <Select.Content className="z-50">
                                                    <Select.ScrollUpButton>
                                                        <ChevronUpIcon />
                                                    </Select.ScrollUpButton>
                                                    <Select.Viewport>
                                                        <Select.Group>
                                                            <Select.Label className="px-3 py-1.5 text-sm text-gray-500">Available Lots</Select.Label>
                                                            {lots.map(lot => (
                                                                <Select.Item key={lot._id} value={lot._id} className="SelectItem">
                                                                    <Select.ItemText>
                                                                        <div className="flex justify-between">
                                                                            <span>{lot.lotCode}</span>
                                                                            <span className="text-gray-500">Qty: {lot.qtyOnHand}</span>
                                                                        </div>
                                                                        <div className="text-xs text-gray-500">
                                                                            Exp: {new Date(lot.expDate).toLocaleDateString()}
                                                                        </div>
                                                                    </Select.ItemText>
                                                                    <Select.ItemIndicator>
                                                                        <CheckIcon />
                                                                    </Select.ItemIndicator>
                                                                </Select.Item>
                                                            ))}
                                                        </Select.Group>
                                                    </Select.Viewport>
                                                    <Select.ScrollDownButton>
                                                        <ChevronDownIcon />
                                                    </Select.ScrollDownButton>
                                                </Select.Content>
                                            </Select.Root>
                                        </div>
                                    )}

                                    <div>
                                        <Label htmlFor="quantity">Quantity</Label>
                                        <Input
                                            type="number"
                                            id="quantity"
                                            value={currentItem.quantity}
                                            onChange={e => setCurrentItem(prev => ({ ...prev, quantity: e.target.value }))}
                                            placeholder="Enter quantity"
                                            min="1"
                                            className="mt-1"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="sourceWarehouse">Source Warehouse</Label>
                                        <Select.Root
                                            value={sourceWarehouse}
                                            onValueChange={setSourceWarehouse}
                                            disabled={user.role !== 'admin' || isLoading}
                                        >
                                            <Select.Trigger className="w-full mt-1">
                                                <Select.Value placeholder="Select source warehouse" />
                                                <Select.Icon>
                                                    <ChevronDownIcon className="h-4 w-4 opacity-50" />
                                                </Select.Icon>
                                            </Select.Trigger>
                                            <Select.Content className="z-50">
                                                <Select.ScrollUpButton>
                                                    <ChevronUpIcon />
                                                </Select.ScrollUpButton>
                                                <Select.Viewport>
                                                    <Select.Group>
                                                        <Select.Label className="px-3 py-1.5 text-sm text-gray-500">Warehouses</Select.Label>
                                                        {warehouses.map(w => (
                                                            <Select.Item
                                                                key={w._id}
                                                                value={w._id}
                                                                className="SelectItem"
                                                                disabled={user.role !== 'admin' && w._id !== user.warehouse}
                                                            >
                                                                <Select.ItemText>
                                                                    <div className="flex items-center">
                                                                        <span>{w.name}</span>
                                                                        <span className="text-gray-500 ml-2">({w.warehouseCode})</span>
                                                                    </div>
                                                                </Select.ItemText>
                                                                <Select.ItemIndicator>
                                                                    <CheckIcon />
                                                                </Select.ItemIndicator>
                                                            </Select.Item>
                                                        ))}
                                                    </Select.Group>
                                                </Select.Viewport>
                                                <Select.ScrollDownButton>
                                                    <ChevronDownIcon />
                                                </Select.ScrollDownButton>
                                            </Select.Content>
                                        </Select.Root>
                                    </div>

                                    <div>
                                        <Label htmlFor="destinationWarehouse">Destination Warehouse</Label>
                                        <Select.Root
                                            value={destinationWarehouse}
                                            onValueChange={setDestinationWarehouse}
                                            disabled={user.role !== 'admin' || isLoading || !sourceWarehouse}
                                        >
                                            <Select.Trigger className="w-full mt-1">
                                                <Select.Value placeholder="Select destination warehouse" />
                                                <Select.Icon>
                                                    <ChevronDownIcon className="h-4 w-4 opacity-50" />
                                                </Select.Icon>
                                            </Select.Trigger>
                                            <Select.Content className="z-50">
                                                <Select.ScrollUpButton>
                                                    <ChevronUpIcon />
                                                </Select.ScrollUpButton>
                                                <Select.Viewport>
                                                    <Select.Group>
                                                        <Select.Label className="px-3 py-1.5 text-sm text-gray-500">Warehouses</Select.Label>
                                                        {warehouses
                                                            .filter(w => w._id !== sourceWarehouse)
                                                            .map(w => (
                                                                <Select.Item
                                                                    key={w._id}
                                                                    value={w._id}
                                                                    className="SelectItem"
                                                                    disabled={user.role !== 'admin' && w._id !== user.warehouse}
                                                                >
                                                                    <Select.ItemText>
                                                                        <div className="flex items-center">
                                                                            <span>{w.name}</span>
                                                                            <span className="text-gray-500 ml-2">({w.warehouseCode})</span>
                                                                        </div>
                                                                    </Select.ItemText>
                                                                    <Select.ItemIndicator>
                                                                        <CheckIcon />
                                                                    </Select.ItemIndicator>
                                                                </Select.Item>
                                                            ))}
                                                    </Select.Group>
                                                </Select.Viewport>
                                                <Select.ScrollDownButton>
                                                    <ChevronDownIcon />
                                                </Select.ScrollDownButton>
                                            </Select.Content>
                                        </Select.Root>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                            <Button
                                onClick={addItem}
                                disabled={isLoading || !currentItem.quantity || (isManualSelection && !currentItem.lotId)}
                                className="min-w-[120px]"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                Add Item
                            </Button>
                        </CardFooter>
                    </Card>

                    {addedItems.length > 0 && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Items to Transfer</CardTitle>
                                    <Badge variant="outline" className="px-3 py-1">
                                        {addedItems.length} {addedItems.length === 1 ? 'Item' : 'Items'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[300px] rounded-md border">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-gray-50">
                                            <TableRow>
                                                <TableHead className="w-[100px]">Code</TableHead>
                                                <TableHead>Product</TableHead>
                                                <TableHead>Lot</TableHead>
                                                <TableHead className="text-right">Qty</TableHead>
                                                <TableHead>Exp Date</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {addedItems.map((item, index) => {
                                                const lotInTable = addedItems.find(i => i.lotCode === item.lotCode);
                                                const lot = lots.find(l => l._id.toString() === item.lotId) || lotInTable;
                                                const productId = lot?.productId?._id?.toString() || lot?.productId?.toString();
                                                const product = productId ? products.find(p => p._id === productId) : null;
                                                return (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-medium">
                                                            {product?.productCode || lotInTable?.productCode || 'N/A'}
                                                        </TableCell>
                                                        <TableCell>{product?.name || lotInTable?.productName || 'Unknown'}</TableCell>
                                                        <TableCell>{item.lotCode}</TableCell>
                                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                                        <TableCell>
                                                            {lot ? new Date(lot.expDate).toLocaleDateString() : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => removeItem(index)}
                                                                disabled={isLoading}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                </svg>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Transfer History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs value={filters.tab} onValueChange={(value) => setFilters(prev => ({ ...prev, tab: value }))}>
                                <TabsList className="grid grid-cols-2 w-[300px] mb-4">
                                    <TabsTrigger value="out">Outgoing</TabsTrigger>
                                    <TabsTrigger value="in">Incoming</TabsTrigger>
                                </TabsList>
                                <Separator className="mb-6" />
                                <div className="flex flex-wrap items-center gap-4 mb-6">
                                    <div className="flex items-center space-x-2">
                                        <Label htmlFor="status">Status</Label>
                                        <Select.Root
                                            value={filters.status}
                                            onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                                        >
                                            <Select.Trigger className="w-[150px]">
                                                <Select.Value placeholder="Status" />
                                                <Select.Icon>
                                                    <ChevronDownIcon className="h-4 w-4 opacity-50" />
                                                </Select.Icon>
                                            </Select.Trigger>
                                            <Select.Content>
                                                <Select.Item value="all">All</Select.Item>
                                                <Select.Item value="Pending">Pending</Select.Item>
                                                <Select.Item value="Confirmed">Confirmed</Select.Item>
                                                <Select.Item value="Rejected">Rejected</Select.Item>
                                            </Select.Content>
                                        </Select.Root>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Label htmlFor="warehouse">Warehouse</Label>
                                        <Select.Root
                                            value={filters.warehouse}
                                            onValueChange={(value) => setFilters(prev => ({ ...prev, warehouse: value }))}
                                        >
                                            <Select.Trigger className="w-[180px]">
                                                <Select.Value placeholder="All Warehouses" />
                                                <Select.Icon>
                                                    <ChevronDownIcon className="h-4 w-4 opacity-50" />
                                                </Select.Icon>
                                            </Select.Trigger>
                                            <Select.Content>
                                                <Select.Item value="all">All Warehouses</Select.Item>
                                                {warehouses.map(w => (
                                                    <Select.Item key={w._id} value={w._id}>
                                                        {w.name}
                                                    </Select.Item>
                                                ))}
                                            </Select.Content>
                                        </Select.Root>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Label htmlFor="startDate">From</Label>
                                        <DatePicker
                                            selected={filters.startDate}
                                            onChange={(date) => setFilters(prev => ({ ...prev, startDate: startOfDay(date) }))}
                                            selectsStart
                                            startDate={filters.startDate}
                                            endDate={filters.endDate}
                                            dateFormat="dd/MM/yyyy"
                                            className="w-[120px] p-2 border rounded-md text-sm"
                                        />
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Label htmlFor="endDate">To</Label>
                                        <DatePicker
                                            selected={filters.endDate}
                                            onChange={(date) => setFilters(prev => ({ ...prev, endDate: endOfDay(date) }))}
                                            selectsEnd
                                            startDate={filters.startDate}
                                            endDate={filters.endDate}
                                            minDate={filters.startDate}
                                            dateFormat="dd/MM/yyyy"
                                            className="w-[120px] p-2 border rounded-md text-sm"
                                        />
                                    </div>
                                </div>

                                <TabsContent value="out">
                                    <ScrollArea className="h-[400px] rounded-md border">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-gray-50">
                                                <TableRow>
                                                    <TableHead>Transfer #</TableHead>
                                                    <TableHead>Destination</TableHead>
                                                    <TableHead>Products</TableHead>
                                                    <TableHead className="text-right">Qty</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {transferHistory
                                                    .filter(transfer => userWarehouseId ? transfer.sourceWarehouseId.toString() === userWarehouseId : true)
                                                    .map((transfer) => {
                                                        const totalQty = transfer.lots.reduce((sum, l) => sum + l.quantity, 0);
                                                        return (
                                                            <TableRow key={transfer._id}>
                                                                <TableCell className="font-medium">{transfer.transferNumber}</TableCell>
                                                                <TableCell>{transfer.destinationWarehouseId?.name || 'N/A'}</TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        {transfer.lots.slice(0, 2).map((lot, i) => (
                                                                            <span key={i} className="text-sm">
                                                                                {lot.lotId?.productId?.name || 'N/A'} ({lot.quantity})
                                                                            </span>
                                                                        ))}
                                                                        {transfer.lots.length > 2 && (
                                                                            <span className="text-xs text-gray-500">+{transfer.lots.length - 2} more</span>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right">{totalQty}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant={transfer.status === 'Pending' ? 'secondary' : transfer.status === 'Confirmed' ? 'default' : 'destructive'}>
                                                                        {transfer.status}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {format(new Date(transfer.createdAt), 'dd MMM yyyy')}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => generatePDF(transfer)}
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                        </svg>
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </TabsContent>

                                <TabsContent value="in">
                                    <ScrollArea className="h-[400px] rounded-md border">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-gray-50">
                                                <TableRow>
                                                    <TableHead>Transfer #</TableHead>
                                                    <TableHead>Source</TableHead>
                                                    <TableHead>Products</TableHead>
                                                    <TableHead className="text-right">Qty</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {transferHistory
                                                    .filter(transfer => userWarehouseId ? transfer.destinationWarehouseId.toString() === userWarehouseId : true)
                                                    .map((transfer) => {
                                                        const isDestination = transfer.destinationWarehouseId.toString() === userWarehouseId;
                                                        const totalQty = transfer.lots.reduce((sum, l) => sum + l.quantity, 0);
                                                        return (
                                                            <TableRow key={transfer._id}>
                                                                <TableCell className="font-medium">{transfer.transferNumber}</TableCell>
                                                                <TableCell>{transfer.sourceWarehouseId?.name || 'N/A'}</TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        {transfer.lots.slice(0, 2).map((lot, i) => (
                                                                            <span key={i} className="text-sm">
                                                                                {lot.lotId?.productId?.name || 'N/A'} ({lot.quantity})
                                                                            </span>
                                                                        ))}
                                                                        {transfer.lots.length > 2 && (
                                                                            <span className="text-xs text-gray-500">+{transfer.lots.length - 2} more</span>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right">{totalQty}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant={transfer.status === 'Pending' ? 'secondary' : transfer.status === 'Confirmed' ? 'default' : 'destructive'}>
                                                                        {transfer.status}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {format(new Date(transfer.createdAt), 'dd MMM yyyy')}
                                                                </TableCell>
                                                                <TableCell className="text-right space-x-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => generatePDF(transfer)}
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                        </svg>
                                                                    </Button>
                                                                    {isDestination && transfer.status === 'Pending' && (
                                                                        <>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="text-green-600 hover:bg-green-50"
                                                                                onClick={() => handleConfirmTransfer(transfer._id)}
                                                                            >
                                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                                </svg>
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="text-red-600 hover:bg-red-50"
                                                                                onClick={() => handleRejectTransfer(transfer._id)}
                                                                            >
                                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                                </svg>
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Confirm Stock Transfer</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Total Items</Label>
                                        <div className="text-lg font-semibold">{addedItems.length}</div>
                                    </div>
                                    <div>
                                        <Label>Total Quantity</Label>
                                        <div className="text-lg font-semibold">
                                            {addedItems.reduce((sum, item) => sum + Number(item.quantity), 0)}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <Label>Source Warehouse</Label>
                                    <div className="text-lg font-semibold">
                                        {warehouses.find(w => w._id.toString() === sourceWarehouse)?.name || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <Label>Destination Warehouse</Label>
                                    <div className="text-lg font-semibold">
                                        {warehouses.find(w => w._id.toString() === destinationWarehouse)?.name || 'N/A'}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={cancelTransfer} disabled={isLoading}>
                                    Cancel
                                </Button>
                                <Button onClick={confirmTransfer} disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Processing...
                                        </>
                                    ) : (
                                        'Confirm Transfer'
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
                </div>
            )}
        </div>
    );
};

export default TransferOrder;