import { useState } from "react";
import api from "../api";
import { success, error } from "../toast";
export default function Waste() {
  const [f, set] = useState({ lotId: "", quantity: "", reason: "" });
  const ch = (e) => set({ ...f, [e.target.name]: e.target.value });
  const sb = async (e) => {
    e.preventDefault();
    try {
      await api.post("/waste", { ...f, quantity: Number(f.quantity) });
      success("Waste recorded");
      set({ lotId: "", quantity: "", reason: "" });
    } catch (err) {
      error(err.response?.data?.message || "err");
    }
  };
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-bold">Waste</h1>
      <form onSubmit={sb} className="space-y-3">
        {["lotId", "quantity", "reason"].map((k) => (
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
