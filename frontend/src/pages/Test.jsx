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
        endDate: endOfDay(new Date())
    });
    const [activeTab, setActiveTab] = useState('newTransfer');

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
            setTransferHistory(data);
        } catch (error) {
            toast.error('Failed to load transfer history');
            console.error('Fetch transfer history error:', error.response?.data);
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
    };

    const handleRejectTransfer = async (transferId) => {
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

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Pending':
                return <Badge variant="secondary">{status}</Badge>;
            case 'Confirmed':
                return <Badge variant="success">{status}</Badge>;
            case 'Rejected':
                return <Badge variant="destructive">{status}</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    return (
        <div className="p-4 md:p-6 mx-auto bg-gray-50 min-h-screen">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Transfer Order Management</h1>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="newTransfer">New Transfer</TabsTrigger>
                        <TabsTrigger value="history">Transfer History</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {isLoading && !products.length ? (
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            ) : (
                <div className="space-y-6">
                    {activeTab === 'newTransfer' && (
                        <>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Create New Transfer</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <Label htmlFor="category">Category</Label>
                                                <Select.Root value={selectedCategory} onValueChange={setSelectedCategory}>
                                                    <Select.Trigger className="w-full">
                                                        <Select.Value placeholder="Select category" />
                                                        <Select.Icon>
                                                            <ChevronDownIcon />
                                                        </Select.Icon>
                                                    </Select.Trigger>
                                                    <Select.Content>
                                                        <Select.Group>
                                                            <Select.Label>Categories</Select.Label>
                                                            <Select.Item value="All">All Products</Select.Item>
                                                            {categories.map(category => (
                                                                <Select.Item key={category._id} value={category._id}>
                                                                    {category.name}
                                                                </Select.Item>
                                                            ))}
                                                        </Select.Group>
                                                    </Select.Content>
                                                </Select.Root>
                                            </div>

                                            <div>
                                                <Label htmlFor="sourceWarehouse">Source Warehouse</Label>
                                                <Select.Root
                                                    value={sourceWarehouse}
                                                    onValueChange={setSourceWarehouse}
                                                    disabled={user.role !== 'admin'}
                                                >
                                                    <Select.Trigger className="w-full">
                                                        <Select.Value placeholder="Select source warehouse" />
                                                        <Select.Icon>
                                                            <ChevronDownIcon />
                                                        </Select.Icon>
                                                    </Select.Trigger>
                                                    <Select.Content>
                                                        <Select.Group>
                                                            <Select.Label>Warehouses</Select.Label>
                                                            {warehouses.map(w => (
                                                                <Select.Item
                                                                    key={w._id}
                                                                    value={w._id}
                                                                    disabled={user.role !== 'admin' && w._id !== user.warehouse}
                                                                >
                                                                    {w.name} ({w.warehouseCode})
                                                                </Select.Item>
                                                            ))}
                                                        </Select.Group>
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
                                                    <Select.Trigger className="w-full">
                                                        <Select.Value placeholder="Select product" />
                                                        <Select.Icon>
                                                            <ChevronDownIcon />
                                                        </Select.Icon>
                                                    </Select.Trigger>
                                                    <Select.Content>
                                                        <Select.Group>
                                                            <Select.Label>Products</Select.Label>
                                                            {filteredProducts.map(product => (
                                                                <Select.Item key={product._id} value={product._id}>
                                                                    {product.name} ({product.productCode})
                                                                </Select.Item>
                                                            ))}
                                                        </Select.Group>
                                                    </Select.Content>
                                                </Select.Root>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <Label htmlFor="destinationWarehouse">Destination Warehouse</Label>
                                                <Select.Root
                                                    value={destinationWarehouse}
                                                    onValueChange={setDestinationWarehouse}
                                                    disabled={user.role !== 'admin' || isLoading || !sourceWarehouse}
                                                >
                                                    <Select.Trigger className="w-full">
                                                        <Select.Value placeholder="Select destination warehouse" />
                                                        <Select.Icon>
                                                            <ChevronDownIcon />
                                                        </Select.Icon>
                                                    </Select.Trigger>
                                                    <Select.Content>
                                                        <Select.Group>
                                                            <Select.Label>Warehouses</Select.Label>
                                                            {warehouses
                                                                .filter(w => w._id !== sourceWarehouse)
                                                                .map(w => (
                                                                    <Select.Item
                                                                        key={w._id}
                                                                        value={w._id}
                                                                        disabled={user.role !== 'admin' && w._id !== user.warehouse}
                                                                    >
                                                                        {w.name} ({w.warehouseCode})
                                                                    </Select.Item>
                                                                ))}
                                                        </Select.Group>
                                                    </Select.Content>
                                                </Select.Root>
                                            </div>

                                            <div className="flex items-center space-x-2">
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
                                                    className="h-4 w-4"
                                                />
                                                <Label htmlFor="manualSelection">Manual Lot Selection</Label>
                                            </div>

                                            {!isManualSelection && (
                                                <div>
                                                    <Label>Selected Lot (FEFO)</Label>
                                                    <Input
                                                        value={lots.length > 0 ? `${lots[0].lotCode} (Qty: ${lots[0].qtyOnHand}, Exp: ${new Date(lots[0].expDate).toLocaleDateString()}` : 'No lots available'}
                                                        readOnly
                                                    />
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
                                                        <Select.Trigger className="w-full">
                                                            <Select.Value placeholder="Select lot" />
                                                            <Select.Icon>
                                                                <ChevronDownIcon />
                                                            </Select.Icon>
                                                        </Select.Trigger>
                                                        <Select.Content>
                                                            <Select.Group>
                                                                <Select.Label>Lots</Select.Label>
                                                                {lots.map(lot => (
                                                                    <Select.Item key={lot._id} value={lot._id}>
                                                                        {lot.lotCode} (Qty: {lot.qtyOnHand}, Exp: {new Date(lot.expDate).toLocaleDateString()})
                                                                    </Select.Item>
                                                                ))}
                                                            </Select.Group>
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
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex justify-end">
                                    <Button
                                        onClick={addItem}
                                        disabled={isLoading || !currentItem.quantity || (isManualSelection && !currentItem.lotId)}
                                        className="w-full md:w-auto"
                                    >
                                        Add Item
                                    </Button>
                                </CardFooter>
                            </Card>

                            {addedItems.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex justify-between items-center">
                                            <span>Items to Transfer</span>
                                            <Badge variant="outline">{addedItems.length} items</Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ScrollArea className="h-[300px] rounded-md border">
                                            <Table>
                                                <TableHeader className="sticky top-0 bg-background">
                                                    <TableRow>
                                                        <TableHead>Product Code</TableHead>
                                                        <TableHead>Product Name</TableHead>
                                                        <TableHead>Lot Code</TableHead>
                                                        <TableHead>Quantity</TableHead>
                                                        <TableHead>Prod Date</TableHead>
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
                                                                <TableCell>{product?.productCode || lotInTable?.productCode || 'N/A'}</TableCell>
                                                                <TableCell>{product?.name || lotInTable?.productName || 'Unknown'}</TableCell>
                                                                <TableCell>{item.lotCode}</TableCell>
                                                                <TableCell>{item.quantity}</TableCell>
                                                                <TableCell>{lot ? format(new Date(lot.prodDate || lot.productionDate), 'dd/MM/yyyy') : '-'}</TableCell>
                                                                <TableCell>{lot ? format(new Date(lot.expDate), 'dd/MM/yyyy') : '-'}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => removeItem(index)}
                                                                        className="text-red-600 hover:text-red-900"
                                                                        disabled={isLoading}
                                                                    >
                                                                        Remove
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                    </CardContent>
                                    <CardFooter className="flex justify-end">
                                        <Button
                                            onClick={handleTransfer}
                                            disabled={isLoading || addedItems.length === 0}
                                            className="w-full md:w-auto"
                                        >
                                            {isLoading ? 'Processing...' : 'Transfer Stock'}
                                        </Button>
                                    </CardFooter>
                                </Card>
                            )}
                        </>
                    )}

                    {activeTab === 'history' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Transfer History</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                    <div>
                                        <Label>Status</Label>
                                        <Select.Root
                                            value={filters.status}
                                            onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                                        >
                                            <Select.Trigger className="w-full">
                                                <Select.Value placeholder="Select status" />
                                                <Select.Icon>
                                                    <ChevronDownIcon />
                                                </Select.Icon>
                                            </Select.Trigger>
                                            <Select.Content>
                                                <Select.Item value="all">All Statuses</Select.Item>
                                                <Select.Item value="Pending">Pending</Select.Item>
                                                <Select.Item value="Confirmed">Confirmed</Select.Item>
                                                <Select.Item value="Rejected">Rejected</Select.Item>
                                            </Select.Content>
                                        </Select.Root>
                                    </div>
                                    <div>
                                        <Label>Warehouse</Label>
                                        <Select.Root
                                            value={filters.warehouse}
                                            onValueChange={(value) => setFilters(prev => ({ ...prev, warehouse: value }))}
                                        >
                                            <Select.Trigger className="w-full">
                                                <Select.Value placeholder="All Warehouses" />
                                                <Select.Icon>
                                                    <ChevronDownIcon />
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
                                    <div>
                                        <Label>Start Date</Label>
                                        <DatePicker
                                            selected={filters.startDate}
                                            onChange={(date) => setFilters(prev => ({ ...prev, startDate: startOfDay(date) }))}
                                            selectsStart
                                            startDate={filters.startDate}
                                            endDate={filters.endDate}
                                            dateFormat="dd/MM/yyyy"
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        />
                                    </div>
                                    <div>
                                        <Label>End Date</Label>
                                        <DatePicker
                                            selected={filters.endDate}
                                            onChange={(date) => setFilters(prev => ({ ...prev, endDate: endOfDay(date) }))}
                                            selectsEnd
                                            startDate={filters.startDate}
                                            endDate={filters.endDate}
                                            minDate={filters.startDate}
                                            dateFormat="dd/MM/yyyy"
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        />
                                    </div>
                                </div>

                                <ScrollArea className="h-[600px] rounded-md border">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-background">
                                            <TableRow>
                                                <TableHead>Transfer #</TableHead>
                                                <TableHead>Source</TableHead>
                                                <TableHead>Destination</TableHead>
                                                <TableHead>Product Code</TableHead>
                                                <TableHead>Product Name</TableHead>
                                                <TableHead>Total Qty</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Date/Time</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {transferHistory.map((transfer) => {
                                                const isDestination = user.role === 'admin' || (transfer.destinationWarehouseId.toString() === userWarehouseId && userWarehouseId);
                                                const totalQty = transfer.lots.reduce((sum, l) => sum + l.quantity, 0);
                                                return (
                                                    <TableRow key={transfer._id}>
                                                        <TableCell className="font-medium">{transfer.transferNumber}</TableCell>
                                                        <TableCell>{transfer.sourceWarehouseId?.name || 'N/A'}</TableCell>
                                                        <TableCell>{transfer.destinationWarehouseId?.name || 'N/A'}</TableCell>
                                                        <TableCell>{transfer.lots.map(l => l.lotId?.productId?.productCode || 'N/A').join(', ') || 'N/A'}</TableCell>
                                                        <TableCell>{transfer.lots.map(l => l.lotId?.productId?.name || 'N/A').join(', ') || 'N/A'}</TableCell>
                                                        <TableCell>{totalQty}</TableCell>
                                                        <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                                                        <TableCell>{format(new Date(transfer.createdAt), 'dd-MM-yyyy, HH:mm')}</TableCell>
                                                        <TableCell className="text-right space-x-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => generatePDF(transfer)}
                                                            >
                                                                View PDF
                                                            </Button>
                                                            {isDestination && transfer.status === 'Pending' && (
                                                                <>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handleConfirmTransfer(transfer._id)}
                                                                        className="bg-green-600 text-white hover:bg-green-700"
                                                                    >
                                                                        Confirm
                                                                    </Button>
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        onClick={() => handleRejectTransfer(transfer._id)}
                                                                    >
                                                                        Reject
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
                            </CardContent>
                        </Card>
                    )}

                    <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Confirm Stock Transfer</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label>Total Items</Label>
                                    <p className="font-medium">{addedItems.length}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Total Quantity</Label>
                                    <p className="font-medium">{addedItems.reduce((sum, item) => sum + Number(item.quantity), 0)}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Source Warehouse</Label>
                                    <p className="font-medium">{warehouses.find(w => w._id.toString() === sourceWarehouse)?.name || 'N/A'}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Destination Warehouse</Label>
                                    <p className="font-medium">{warehouses.find(w => w._id.toString() === destinationWarehouse)?.name || 'N/A'}</p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={cancelTransfer} disabled={isLoading}>
                                    Cancel
                                </Button>
                                <Button onClick={confirmTransfer} disabled={isLoading}>
                                    Confirm
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