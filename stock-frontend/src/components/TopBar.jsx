
import React from 'react';
import { Bars3Icon, BellIcon } from '@heroicons/react/24/outline';
export default function TopBar({ onMenu }){
  return (
    <header className="flex items-center justify-between bg-white shadow px-4 py-2">
      <button className="lg:hidden" onClick={onMenu}><Bars3Icon className="h-6 w-6"/></button>
      <div className="flex-1" />
      <button className="relative mr-4">
        <BellIcon className="h-6 w-6"/>
        <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs h-4 w-4 flex items-center justify-center">3</span>
      </button>
      <div className="flex items-center space-x-2">
        <span className="text-sm">Admin</span>
        <img src="https://ui-avatars.com/api/?name=Admin" className="h-8 w-8 rounded-full" />
      </div>
    </header>
  );
}
