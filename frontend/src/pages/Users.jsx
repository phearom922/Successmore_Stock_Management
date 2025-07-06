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

import { FaPlus, FaEdit, FaTrash, FaEye, FaToggleOn, FaToggleOff } from 'react-icons/fa';

const defaultFeatures = ['lotManagement', 'manageDamage', 'category', 'products'];
const defaultPermissions = defaultFeatures.map(f => ({ feature: f, permissions: [] }));

const Users = () => {
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [openModal, setOpenModal] = useState(false);
  const [form, setForm] = useState({ username: '', lastName: '', password: '', role: 'user', assignedWarehouse: '', permissions: defaultPermissions });
  const [editingId, setEditingId] = useState(null);
  const [viewUser, setViewUser] = useState(null);

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
    try {
      const [userRes, whRes] = await Promise.all([
        axios.get('http://localhost:3000/api/users', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:3000/api/warehouses', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setUsers(userRes.data);
      setWarehouses(whRes.data);
    } catch {
      toast.error('Failed to load users or warehouses');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.lastName.toLowerCase().includes(search.toLowerCase());
    const matchWarehouse = warehouseFilter === 'all' || (u.assignedWarehouse && u.assignedWarehouse.toString().toLowerCase().includes(warehouseFilter.toLowerCase()));
    return matchSearch && matchWarehouse;
  });

  const resetForm = () => {
    setForm({ username: '', lastName: '', password: '', role: 'user', assignedWarehouse: '', permissions: defaultPermissions });
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!form.username || !form.lastName || (!editingId && !form.password) || !form.assignedWarehouse) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      if (editingId) {
        // ตรวจสอบว่า assignedWarehouse เปลี่ยนจริงหรือไม่
        const originalUser = users.find(u => u._id === editingId);
        let assignedWarehouse = form.assignedWarehouse;
        if (typeof assignedWarehouse === 'string' && assignedWarehouse.includes('(')) {
          assignedWarehouse = assignedWarehouse.split('(')[0].trim();
        }
        let updatePayload = { ...form, assignedWarehouse };
        // ถ้า assignedWarehouse ไม่เปลี่ยน ให้ไม่ส่ง field นี้ (ป้องกัน backend เช็คซ้ำ)
        let originalAssigned = originalUser?.assignedWarehouse;
        if (typeof originalAssigned === 'string' && originalAssigned.includes('(')) {
          originalAssigned = originalAssigned.split('(')[0].trim();
        }
        if (assignedWarehouse === originalAssigned) {
          delete updatePayload.assignedWarehouse;
        }
        await axios.put(`http://localhost:3000/api/users/${editingId}`, updatePayload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('User updated');
      } else {
        await axios.post(`http://localhost:3000/api/users`, form, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('User created');
      }
      fetchData();
      setOpenModal(false);
      resetForm();
    } catch {
      toast.error('Error saving user');
    }
  };

  const handleEdit = (user) => {
    // ดึงชื่อ warehouse จริง (ถ้ามีโค้ดหรือชื่อประกอบกัน เช่น "ชื่อ (รหัส)")
    let assignedWarehouse = user.assignedWarehouse;
    if (typeof assignedWarehouse === 'string' && assignedWarehouse.includes('(')) {
      assignedWarehouse = assignedWarehouse.split('(')[0].trim();
    }
    setForm({
      ...user,
      password: '', // รีเซ็ต password เฉพาะ
      permissions: user.permissions || defaultPermissions,
      assignedWarehouse
    });
    setEditingId(user._id);
    setOpenModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await axios.delete(`http://localhost:3000/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User deleted');
      fetchData();
    } catch {
      toast.error('Delete failed');
    }
  };

  const toggleActive = async (user) => {
    try {
      const payload = { isActive: !user.isActive };
      await axios.put(`http://localhost:3000/api/users/${user._id}`, payload, {
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
              <div className="grid grid-cols-2 gap-6 py-6">
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
                <Select value={form.assignedWarehouse} onValueChange={(val) => setForm({ ...form, assignedWarehouse: val })}>
                  <SelectTrigger className="w-full border-gray-300 focus:ring-indigo-500 focus:border-indigo-500">
                    <SelectValue placeholder="Select Warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w._id} value={w.name}>
                        {w.name} ({w.warehouseCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-6">
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
            {/* แถบซ้าย: User */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Users</h3>
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
                        <Badge className="bg-blue-100 text-blue-800">{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.assignedWarehouse || <span className="text-gray-400">-</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'outline'} className={user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {user.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="icon" variant="ghost" onClick={() => setViewUser(user)} className="text-blue-600 hover:text-blue-800">
                          <FaEye />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(user)} className="text-blue-600 hover:text-blue-800">
                          <FaEdit />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(user._id)} className="text-red-600 hover:text-red-800">
                          <FaTrash />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => toggleActive(user)} className="text-purple-600 hover:text-purple-800">
                          {user.isActive ? <FaToggleOff /> : <FaToggleOn />}
                        </Button>
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
                <div><strong className="text-gray-700">Warehouse:</strong> {viewUser.assignedWarehouse}</div>
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