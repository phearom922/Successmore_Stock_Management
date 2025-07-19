import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import { FaPlus, FaRegTrashAlt, FaRegEdit, FaEye, FaToggleOn, FaToggleOff } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;




const defaultFeatures = ['lotManagement', 'manageDamage', 'category', 'products'];
const defaultPermissions = defaultFeatures.map(f => ({ feature: f, permissions: [] }));
const Users = () => {
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [openModal, setOpenModal] = useState(false);
  const [form, setForm] = useState({ username: '', lastName: '', password: '', role: 'user', warehouse: '', permissions: defaultPermissions });
  const [editingId, setEditingId] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null });
  const [isFetching, setIsFetching] = useState(false);

  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const userRole = token ? JSON.parse(atob(token.split('.')[1])).role : '';

  useEffect(() => {
    if (!token) return navigate('/login');
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('token');
      toast.error('Session expired, please login again');
      navigate('/login');
    }
    if (userRole !== 'admin') {
      toast.error('Unauthorized');
      navigate('/');
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    if (isFetching) return;
    setIsFetching(true);
    try {
      const [userRes, whRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/api/warehouses`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      console.log('Fetched users:', userRes.data);
      console.log('Fetched warehouses:', whRes.data.map(w => ({ _id: w._id, name: w.name, warehouseCode: w.warehouseCode })));
      setUsers(userRes.data);
      setWarehouses(whRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load users or warehouses');
    } finally {
      setIsFetching(false);
    }
  };

  const refreshWarehouses = async () => {
    try {
      const whRes = await axios.get(`${API_BASE_URL}/api/warehouses`, { headers: { Authorization: `Bearer ${token}` } });
      console.log('Refreshed warehouses:', whRes.data.map(w => ({ _id: w._id, name: w.name, warehouseCode: w.warehouseCode })));
      setWarehouses(whRes.data);
    } catch (error) {
      console.error('Error refreshing warehouses:', error);
      toast.error('Failed to refresh warehouses');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.lastName.toLowerCase().includes(search.toLowerCase());
    let warehouseId = u.warehouse;
    if (warehouseId && typeof warehouseId === 'string' && warehouseId.includes('(')) {
      warehouseId = warehouseId.split(' ')[0]; // ตัดส่วนที่ไม่ใช่ _id
    }
    const warehouse = warehouseId ? warehouses.find(w => w._id.toString() === warehouseId) : null;
    const isAssigned = warehouse ? warehouse.assignedUsers.some(userId => userId.toString() === u._id.toString()) : false;
    const warehouseName = isAssigned && warehouse ? warehouse.name : '';
    const matchWarehouse = warehouseFilter === 'all' ||
      (warehouseName && warehouseName.toLowerCase().includes(warehouseFilter.toLowerCase()));
    console.log(`User: ${u.username}, Warehouse ID: ${warehouseId}, Found Warehouse: ${warehouse ? warehouse.name : 'Not Found'}, Is Assigned: ${isAssigned}`);
    return matchSearch && matchWarehouse;
  });

  const resetForm = () => {
    setForm({ username: '', lastName: '', password: '', role: 'user', warehouse: '', permissions: defaultPermissions });
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!form.username || !form.lastName || (!editingId && !form.password)) {
      toast.error('Please fill all required fields');
      return;
    }

    console.log('Submitting form:', form);
    try {
      if (editingId) {
        const originalUser = users.find(u => u._id === editingId);
        let updatePayload = { ...form };
        if (form.warehouse === originalUser.warehouse) {
          delete updatePayload.warehouse;
        } else if (!form.warehouse || form.warehouse === '' || form.warehouse === 'None') {
          updatePayload.warehouse = null; // ส่ง null แทน "None"
        } else {
          const warehouse = warehouses.find(w => w._id.toString() === form.warehouse);
          if (warehouse) {
            const isAssigned = warehouse.assignedUsers.some(userId => userId.toString() === editingId);
            if (!isAssigned) {
              toast.error('Cannot change warehouse unless assigned in Warehouse Management');
              return;
            }
          }
        }
        await axios.put(`${API_BASE_URL}/api/users/${editingId}`, updatePayload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('User updated');
      } else {
        const defaultWarehouse = warehouses.find(w => w.warehouseCode === 'PNH-WH-01');
        const payload = { ...form, warehouse: form.warehouse || (defaultWarehouse ? defaultWarehouse._id : warehouses.length > 0 ? warehouses[0]._id : null) };
        if (payload.role === 'user' && !payload.warehouse) {
          toast.error('User role must have an assigned warehouse');
          return;
        }
        const response = await axios.post(`${API_BASE_URL}/api/users`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (payload.warehouse) {
          await axios.put(`${API_BASE_URL}/api/warehouses/${payload.warehouse}`, {
            assignedUsers: [response.data.user._id]
          }, { headers: { Authorization: `Bearer ${token}` } });
        }
        toast.success('User created successfully');
        navigate('/users');
        await refreshWarehouses();
        await fetchData();
      }
      setOpenModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving user:', error.response?.data || error);
      toast.error('Error saving user: ' + (error.response?.data?.message || error.message));
      setOpenModal(false);
      resetForm();
    }
  };

  const handleEdit = (user) => {
    setForm({
      ...user,
      password: '',
      permissions: user.permissions || defaultPermissions,
      warehouse: user.warehouse || '',
    });
    setEditingId(user._id);
    setOpenModal(true);
  };

  const handleDelete = async (id) => {
    try {
      const user = users.find(u => u._id === id);
      await axios.delete(`${API_BASE_URL}/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User deleted');
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error.response?.data || error);
      toast.error('Delete failed: ' + (error.response?.data?.message || error.message));
    }
  };

  const toggleActive = async (user) => {
    try {
      const payload = { isActive: !user.isActive };
      await axios.put(`${API_BASE_URL}/api/users/${user._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(user.isActive ? 'User disabled' : 'User activated');
      fetchData();
    } catch (error) {
      console.error('Error toggling user active status:', error.response?.data || error);
      toast.error('Failed to update status');
    }
  };

  const togglePermission = (feature, perm) => {
    setForm(prev => {
      const updatedPermissions = prev.permissions.map(p => {
        if (p.feature === feature) {
          const hasPerm = p.permissions.includes(perm);
          return {
            ...p,
            permissions: hasPerm
              ? p.permissions.filter(p => p !== perm)
              : [...p.permissions, perm]
          };
        }
        return p;
      });
      return { ...prev, permissions: updatedPermissions };
    });
  };

  return (
    <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-600 mt-1">Efficiently manage users and their permissions</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-md shadow-sm"
          />
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-48 border-gray-300 focus:ring-indigo-500 focus:border-indigo-500">
              <SelectValue placeholder="Filter by Warehouse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w._id} value={w.name}>{w.name} ({w.warehouseCode})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={openModal} onOpenChange={setOpenModal}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2">
                <FaPlus /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl bg-white rounded-lg shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold text-gray-900">
                  {editingId ? 'Edit User' : 'Create User'}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-3">
                <Input
                  placeholder="Username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <Input
                  placeholder="Last Name"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <Select value={form.role} onValueChange={(val) => setForm({ ...form, role: val })}>
                  <SelectTrigger className="w-full border-gray-300 focus:ring-indigo-500 focus:border-indigo-500">
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={form.warehouse} onValueChange={(val) => setForm({ ...form, warehouse: val })}>
                  <SelectTrigger className="w-full border-gray-300 focus:ring-indigo-500 focus:border-indigo-500">
                    <SelectValue placeholder="Select Warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w._id} value={w._id}>{w.name} ({w.warehouseCode})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-700 mb-4">Permissions</h4>
                <Card className="border-gray-200 shadow-sm">
                  <CardContent className="p-4">
                    <Table className="text-sm">
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold text-gray-600">Feature</TableHead>
                          <TableHead className="font-semibold text-gray-600">Show</TableHead>
                          <TableHead className="font-semibold text-gray-600">Edit</TableHead>
                          <TableHead className="font-semibold text-gray-600">Cancel</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {defaultFeatures.map((feature) => {
                          const perms = form.permissions.find((p) => p.feature === feature)?.permissions || [];
                          return (
                            <TableRow key={feature} className="hover:bg-gray-100">
                              <TableCell className="font-medium text-gray-800">{feature}</TableCell>
                              {['Show', 'Edit', 'Cancel'].map((perm) => (
                                <TableCell key={perm} className="p-2">
                                  <input
                                    type="checkbox"
                                    checked={perms.includes(perm)}
                                    onChange={() => togglePermission(feature, perm)}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                  />
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <DialogFooter className="mt-6 flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => { setOpenModal(false); resetForm(); }}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {editingId ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-gray-200 shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-800">User List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
            <div>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-600">User</TableHead>
                    <TableHead className="font-semibold text-gray-600">Role</TableHead>
                    <TableHead className="font-semibold text-gray-600">Warehouse</TableHead>
                    <TableHead className="font-semibold text-gray-600">Status</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.filter(user => user.role).map((user) => (
                    <TableRow key={user._id} className="hover:bg-gray-100">
                      <TableCell>
                        <div className="font-medium text-gray-900">{user.username}</div>
                        <div className="text-gray-500 text-sm">{user.lastName}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${user.role === "user" ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"} `}>{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.warehouse && typeof user.warehouse === 'string' && user.warehouse.includes('(')
                          ? (warehouses.find(w => w._id.toString() === user.warehouse.split(' ')[0])?.name || 'Not Assigned')
                          : (user.warehouse ?
                            (warehouses.find(w => w._id.toString() === user.warehouse.toString())?.name || 'Not Assigned') : 'Not Assigned')}
                        {user.warehouse && warehouses.find(w => w._id.toString() === (typeof user.warehouse === 'string' && user.warehouse.includes('(') ? user.warehouse.split(' ')[0] : user.warehouse.toString()))?.assignedUsers.includes(user._id) ? '' : ' (Not Assigned)'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'outline'} className={user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {user.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setViewUser(user)} className="text-red-600 hover:text-red-900 p-1 rounded border border-red-200 hover:border-red-300" aria-label="View">
                            <FaEye />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(user)} className="text-blue-600 hover:text-blue-900 p-1 rounded border border-blue-200 hover:border-blue-300" aria-label="Edit">
                            <FaRegEdit />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteModal({ open: true, user })} className="text-red-600 hover:text-red-900 p-1 rounded border border-red-200 hover:border-blue-300" aria-label="Delete">
                            <FaRegTrashAlt />
                          </Button>
                          <Dialog open={deleteModal.open} onOpenChange={open => setDeleteModal(d => ({ ...d, open }))}>
                            <DialogContent className="max-w-md bg-white rounded-lg shadow-lg">
                              <DialogHeader>
                                <DialogTitle className="text-xl font-semibold text-gray-900">Confirm Delete</DialogTitle>
                              </DialogHeader>
                              <div className="py-4 text-gray-700">
                                {deleteModal.user && (
                                  <>
                                    <p>Are you sure you want to delete user <span className="font-bold text-red-600">{deleteModal.user.username}</span>?</p>
                                    <p className="mt-2 text-sm text-gray-500">This action cannot be undone.</p>
                                    {deleteModal.user.warehouse && (
                                      <p className="mt-2 text-sm text-yellow-600">
                                        Warning: This user is assigned to {warehouses.find(w => w._id.toString() === (deleteModal.user.warehouse.includes('(') ? deleteModal.user.warehouse.split(' ')[0] : deleteModal.user.warehouse.toString()))?.name || 'a warehouse'}. Please update Warehouse Management after deletion.
                                      </p>
                                    )}
                                    <p className="mt-4 text-xs text-gray-500">Admin: <span className="font-semibold text-indigo-600">{userRole}</span></p>
                                  </>
                                )}
                              </div>
                              <DialogFooter className="flex justify-end gap-3">
                                <Button variant="outline" onClick={() => setDeleteModal({ open: false, user: null })} className="border-gray-300 text-gray-700 hover:bg-gray-100">Cancel</Button>
                                <Button onClick={async () => {
                                  await handleDelete(deleteModal.user._id);
                                  setDeleteModal({ open: false, user: null });
                                }} className="bg-red-600 hover:bg-red-700 text-white">Delete</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button size="icon" variant="ghost" onClick={() => toggleActive(user)} className={`rounded-full transition-all duration-150 ${user.isActive ? 'hover:bg-purple-50 text-purple-600 hover:text-purple-800' : 'hover:bg-green-50 text-green-600 hover:text-green-800'}`} aria-label="Toggle Active">
                            {user.isActive ? <FaToggleOff className="w-4 h-4" /> : <FaToggleOn className="w-4 h-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
        <DialogContent className="max-w-2xl bg-white rounded-lg shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-gray-900">View Permissions</DialogTitle>
          </DialogHeader>
          {viewUser && (
            <>
              <div className="grid grid-cols-2 gap-6 text-sm mb-6 p-4 bg-gray-50 rounded-md">
                <div><strong className="text-gray-700">Name:</strong> {viewUser.username} {viewUser.lastName}</div>
                <div><strong className="text-gray-700">Role:</strong> {viewUser.role}</div>
                <div><strong className="text-gray-700">Status:</strong> {viewUser.isActive ? 'Active' : 'Disabled'}</div>
                <div><strong className="text-gray-700">Warehouse:</strong> {viewUser.warehouse && typeof viewUser.warehouse === 'string' && viewUser.warehouse.includes('(')
                  ? (warehouses.find(w => w._id.toString() === viewUser.warehouse.split(' ')[0])?.name || 'Not Assigned')
                  : (viewUser.warehouse ? warehouses.find(w => w._id.toString() === viewUser.warehouse.toString())?.name || 'Not Assigned' : 'Not Assigned')}
                  {viewUser.warehouse && !warehouses.find(w => w._id.toString() === (typeof viewUser.warehouse === 'string' && viewUser.warehouse.includes('(') ? viewUser.warehouse.split(' ')[0] : viewUser.warehouse.toString()))?.assignedUsers.includes(viewUser._id) ? ' (Not Assigned)' : ''}</div>
              </div>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-600">Feature</TableHead>
                    <TableHead className="font-semibold text-gray-600">Show</TableHead>
                    <TableHead className="font-semibold text-gray-600">Edit</TableHead>
                    <TableHead className="font-semibold text-gray-600">Cancel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {defaultFeatures.map((f) => {
                    const perms = viewUser.permissions?.find((p) => p.feature === f)?.permissions || [];
                    return (
                      <TableRow key={f} className="hover:bg-gray-100">
                        <TableCell className="font-medium text-gray-800">{f}</TableCell>
                        <TableCell className="p-2"><input type="checkbox" checked={perms.includes('Show')} readOnly className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" /></TableCell>
                        <TableCell className="p-2"><input type="checkbox" checked={perms.includes('Edit')} readOnly className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" /></TableCell>
                        <TableCell className="p-2"><input type="checkbox" checked={perms.includes('Cancel')} readOnly className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <DialogFooter className="mt-6 flex justify-end">
                <Button onClick={() => setViewUser(null)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;