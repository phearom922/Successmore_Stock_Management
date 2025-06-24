import { useState, useEffect } from "react";
import api from "../api";
import { toast } from "react-toastify";
export default function Products() {
  const [list, setList] = useState([]);
  const [f, setF] = useState({
    sku: "",
    name: "",
    baseUom: "",
    reorderPoint: 0,
  });
  const [edit, setE] = useState(null);
  const load = async () => {
    const res = await api.get("/products");
    setList(Array.isArray(res.data) ? res.data : []);
  };
  useEffect(() => {
    api
      .get("/products")
      .then((r) => setList(Array.isArray(r.data) ? r.data : []));
  }, []);
  const save = async () => {
    try {
      if (edit) await api.put("/products/" + edit._id, f);
      else await api.post("/products", f);
      toast("saved");
      load();
      setF({ sku: "", name: "", baseUom: "", reorderPoint: 0 });
      setE(null);
    } catch (e) {
      toast.error(e.response.data.message);
    }
  };
  return (
    <div>
      <h1>Products</h1>
      {["sku", "name", "baseUom", "reorderPoint"].map((k) => (
        <input
          key={k}
          onChange={(e) => setF({ ...f, [k]: e.target.value })}
          value={f[k]}
          placeholder={k}
        />
      ))}
      <button onClick={save}>{edit ? "Update" : "Add"}</button>
      <ul>
        {list.map((p) => (
          <li key={p._id}>
            {p.sku}-{p.name}
            <button
              onClick={() => {
                setF(p);
                setE(p);
              }}
            >
              edit
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
