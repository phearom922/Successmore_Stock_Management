
import React from 'react';
import { NavLink } from 'react-router-dom';
const links = [
  { to:'/', label:'Dashboard' },
  { to:'/products', label:'Products' },
  { to:'/lots', label:'Lots & Stock' },
  { to:'/receive', label:'Receive' },
  { to:'/issue', label:'Issue' },
  { to:'/transfers', label:'Transfers' },
  { to:'/waste', label:'Waste' },
  { to:'/reports', label:'Reports' },
];
export default function Sidebar({ open, onClose }){
  return (
    <aside className={`fixed inset-y-0 left-0 w-64 bg-white shadow transform transition-transform z-40
      ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div className="p-4 font-bold text-xl">Stock Manager</div>
      <nav className="space-y-1 px-2">
        {links.map(l => (
          <NavLink key={l.to} to={l.to} onClick={onClose}
            className={({ isActive }) => `block rounded px-3 py-2 text-sm ${isActive ? 'bg-primary text-white' : 'hover:bg-gray-100'}`}>
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
