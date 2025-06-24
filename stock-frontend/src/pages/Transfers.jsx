import React, { useState } from "react";
import api from "../api";
import { success, error } from "../toast";
export default function Transfers() {
  const [f, set] = useState({
    productId: "",
    fromWh: "",
    toWh: "",
    quantity: "",
    remark: "",
  });
  const ch = (e) => set({ ...f, [e.target.name]: e.target.value });
  const sb = async (e) => {
    e.preventDefault();
    try {
      await api.post("/transfer", { ...f, quantity: Number(f.quantity) });
      success("Transfer ok");
      set({ productId: "", fromWh: "", toWh: "", quantity: "", remark: "" });
    } catch (err) {
      error(err.response?.data?.message || "err");
    }
  };
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-bold">Transfer</h1>
      <form onSubmit={sb} className="space-y-3">
        {["productId", "fromWh", "toWh", "quantity", "remark"].map((k) => (
          <input
            key={k}
            name={k}
            type={k === "quantity" ? "number" : "text"}
            value={f[k]}
            onChange={ch}
            placeholder={k}
            className="border p-2 w-full"
          />
        ))}
        <button className="px-4 py-2 bg-primary text-white rounded">
          Save
        </button>
      </form>
    </div>
  );
}
