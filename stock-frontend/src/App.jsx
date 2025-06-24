
import React,{useState} from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Lots from './pages/Lots';
import Warehouses from './pages/Warehouses';
import Suppliers from './pages/Suppliers';
import Receive from './pages/Receive';
import Issue from './pages/Issue';
import Transfers from './pages/Transfers';
import Waste from './pages/Waste';
import Reports from './pages/Reports';
import Users from './pages/Users';

export default function App(){
  const [open,setOpen]=useState(false);
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={open} onClose={()=>setOpen(false)}/>
      <div className="flex flex-col flex-1 overflow-auto">
        <TopBar onMenu={()=>setOpen(true)}/>
        <main className="p-4 lg:p-6">
          <Routes>
            <Route path="/" element={<Dashboard/>}/>
            <Route path="/products" element={<Products/>}/>
            <Route path="/lots" element={<Lots/>}/>
            <Route path="/warehouses" element={<Warehouses/>}/>
            <Route path="/suppliers" element={<Suppliers/>}/>
            <Route path="/receive" element={<Receive/>}/>
            <Route path="/issue" element={<Issue/>}/>
            <Route path="/transfers" element={<Transfers/>}/>
            <Route path="/waste" element={<Waste/>}/>
            <Route path="/reports" element={<Reports/>}/>
            <Route path="/users" element={<Users/>}/>
            <Route path="*" element={<Navigate to="/" />}/>
          </Routes>
        </main>
      </div>
    </div>
  );
}
