
import React,{useState} from'react';import api from'../api';import {success,error} from'../toast';
export default function Receive(){
  const [form,set]=useState({lotCode:'',productId:'',warehouseId:'',quantity:''});
  const ch=e=>set({...form,[e.target.name]:e.target.value});
  const submit=async e=>{e.preventDefault();try{await api.post('/receive',{...form,quantity:Number(form.quantity)});success('Received');set({lotCode:'',productId:'',warehouseId:'',quantity:''});}catch(err){error(err.response?.data?.message||'err');}};
  return (<div className='max-w-md space-y-4'><h1 className='text-xl font-bold'>Receive</h1><form onSubmit={submit} className='space-y-3'>
    {['lotCode','productId','warehouseId','quantity'].map(f=><input key={f} name={f} type={f==='quantity'?'number':'text'} value={form[f]} onChange={ch} placeholder={f} className='border p-2 w-full'/>)}
    <button className='px-4 py-2 bg-primary text-white rounded'>Save</button></form></div>);
}
