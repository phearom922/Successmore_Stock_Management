import React, { useState, useEffect } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { startOfDay, endOfDay, format } from "date-fns";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import jsPDF from "jspdf";
import { fontTH } from "../fonts/NotoSansThai-normal";
import { fontKH } from "../fonts/KantumruyPro-normal";
import * as XLSX from "xlsx";

const IssueHistory = () => {
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  // Initialize dates with start and end of current day
  const [startDate, setStartDate] = useState(startOfDay(new Date()));
  const [endDate, setEndDate] = useState(endOfDay(new Date()));

  const [filters, setFilters] = useState({
    type: "all",
    warehouse: "all",
    status: "all",
    searchUser: "",
    searchTransaction: "",
  });

  // เมื่อ user ถูก set แล้ว ถ้าไม่ใช่ admin ให้ set warehouse filter เป็น warehouseId ของ user
  useEffect(() => {
    if (user && user.role !== "admin" && user.warehouse) {
      setFilters((prev) => ({ ...prev, warehouse: user.warehouse }));
    }
  }, [user]);

  // Initialize user and fetch data
  const initializeUser = () => {
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUser(payload);
      setUserId(payload.id);
    } catch (error) {
      console.error("Error parsing token:", error);
      toast.error("Invalid token, please log in again");
      navigate("/login");
    }
  };

  useEffect(() => {
    initializeUser();
    fetchData();
    fetchWarehouses();
  }, [token, navigate]);

  const fetchWarehouses = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/warehouses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWarehouses(data);
    } catch (error) {
      toast.error("Failed to load warehouses");
    }
  };

  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      console.log(
        "Fetching with startDate:",
        startDate.toISOString(),
        "endDate:",
        endDate.toISOString(),
      );
      const params = {
        type: filters.type !== "all" ? filters.type : undefined,
        warehouse: filters.warehouse !== "all" ? filters.warehouse : undefined,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
      if (filters.status === "Active" || filters.status === "Cancelled") {
        params.status = filters.status;
      }
      const { data } = await axios.get(`${API_BASE_URL}/api/issue-history`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      const enrichedHistory = await Promise.all(
        data.map(async (transaction) => {
          const lotsWithDetails = await Promise.all(
            transaction.lots.map(async (lot) => {
              try {
                const response = await axios.get(
                  `${API_BASE_URL}/api/lots/${lot.lotId}`,
                  {
                    headers: { Authorization: `Bearer ${token}` },
                  },
                );
                const dbLot = response.data;
                return {
                  ...lot,
                  productCode: dbLot.productId?.productCode || "N/A",
                  productName: dbLot.productId?.name || "N/A",
                  lotCode: dbLot.lotCode || "N/A",
                  productionDate: dbLot.productionDate || null,
                  expDate: dbLot.expDate || null,
                };
              } catch (error) {
                console.error(`Failed to fetch lot ${lot.lotId}:`, error);
                return {
                  ...lot,
                  productCode: "N/A",
                  productName: "N/A",
                  lotCode: "N/A",
                  productionDate: null,
                  expDate: null,
                };
              }
            }),
          );
          return { ...transaction, lots: lotsWithDetails };
        }),
      );

      const sortedHistory = enrichedHistory.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );
      setHistory(sortedHistory);
      setFilteredHistory(sortedHistory);
      setCurrentPage(1);
    } catch (error) {
      toast.error("Failed to load issue history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let results = [...history];

    if (filters.searchUser) {
      results = results.filter((t) =>
        t.userId.username
          .toLowerCase()
          .includes(filters.searchUser.toLowerCase()),
      );
    }

    if (filters.searchTransaction) {
      results = results.filter((t) =>
        t.transactionNumber
          .toLowerCase()
          .includes(filters.searchTransaction.toLowerCase()),
      );
    }

    if (filters.status === "Active" || filters.status === "Cancelled") {
      results = results.filter((t) => t.status === filters.status);
    }

    setFilteredHistory(results);
    setCurrentPage(1);
  }, [history, filters.searchUser, filters.searchTransaction, filters.status]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredHistory.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  const handleCancel = async (transactionId) => {
    if (!userId) {
      toast.error("User not authenticated, please log in again");
      return;
    }

    setIsLoading(true);
    setConfirmCancel(null);

    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/issue-history/${transactionId}/cancel`,
        { cancelledBy: userId, cancelledDate: new Date() },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(response.data.message);

      // Send Telegram notification
      const transaction = history.find((t) => t._id === transactionId);
      if (transaction) {
        await sendTelegramNotification(transaction);
      }

      fetchData();
    } catch (error) {
      toast.error(
        `Failed to cancel transaction: ${error.response?.status} - ${error.response?.data?.message || error.message}`,
      );
      console.error("Error cancelling transaction:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendTelegramNotification = async (transaction) => {
    const totalQty = transaction.lots.reduce(
      (sum, lot) => sum + lot.quantity,
      0,
    );
    const message = `
*Transaction Notification*
- Transaction #: ${transaction.transactionNumber}
- Warehouse: ${transaction.warehouseId.name}
- Issue Type: ${transaction.type}
- Total Qty: ${totalQty}
- User: ${transaction.userId.lastName}
- Status: "Cancelled"
- Date/Time: ${format(new Date(transaction.createdAt), "dd/MM/yyyy, HH:mm:ss")}
    `.trim();

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/telegram/send`,
        {
          chat_id: "-4871143154",
          text: message,
          parse_mode: "Markdown",
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      console.log("Telegram notification response:", response.data);
    } catch (error) {
      console.error("Failed to send Telegram notification:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      toast.error(
        `Failed to send Telegram notification: ${error.response?.data?.description || error.message}`,
      );
    }
  };

  // PDF Generate================
  const generatePDF = (transaction) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      filters: ["ASCIIHexEncode"],
    });

    // ลงทะเบียนฟอนต์
    doc.addFileToVFS("NotoSansThai.ttf", fontTH);
    doc.addFont("NotoSansThai.ttf", "NotoSansThai", "normal");
    doc.addFileToVFS("KantumruyPro.ttf", fontKH);
    doc.addFont("KantumruyPro.ttf", "KantumruyPro", "normal");

    // ตั้งฟอนต์เริ่มต้นเป็น helvetica
    doc.setFont("helvetica", "normal");

    // -------------------- ส่วนหัว (Header) --------------------
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text("TRANSACTION REQUEST", 105, 10, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Issue Document", 105, 15, { align: "center" });

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(15, 20, 195, 20);

    doc.setFontSize(10);
    const leftX = 20;
    const rightX = 110;
    let infoY = 25;

    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "bold");
    doc.text("Transaction #:", leftX, infoY);
    doc.setFont("helvetica", "normal");
    doc.text(transaction.transactionNumber, leftX + 30, infoY);

    doc.setFont("helvetica", "bold");
    doc.text("Issue Type:", leftX, infoY + 7);
    doc.setFont("helvetica", "normal");
    doc.text(transaction.type, leftX + 30, infoY + 7);

    doc.setFont("helvetica", "bold");
    doc.text("Issued By:", leftX, infoY + 14);
    doc.setFont("helvetica", "normal");
    doc.text(transaction.userId?.username || "-", leftX + 30, infoY + 14);

    doc.setFont("helvetica", "bold");
    doc.text("Cancelled By:", leftX, infoY + 21);
    doc.setFont("helvetica", "normal");
    doc.text(transaction.cancelledBy?.username || "-", leftX + 30, infoY + 21);

    doc.setFont("helvetica", "bold");
    doc.text("Warehouse:", rightX, infoY);
    doc.setFont("helvetica", "normal");
    doc.text(transaction.warehouseId.name, rightX + 30, infoY);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", rightX, infoY + 7);
    doc.setFont("helvetica", "normal");
    doc.text(
      format(new Date(transaction.createdAt), "dd/MM/yyyy, HH:mm:ss"),
      rightX + 30,
      infoY + 7,
    );

    doc.setFont("helvetica", "bold");
    doc.text("Status:", rightX, infoY + 14);
    doc.setFont("helvetica", "normal");
    doc.text(transaction.status, rightX + 30, infoY + 14);

    doc.setFont("helvetica", "bold");
    doc.text("Cancelled Date:", rightX, infoY + 21);
    doc.setFont("helvetica", "normal");
    doc.text(
      transaction.cancelledDate
        ? format(new Date(transaction.cancelledDate), "dd/MM/yyyy, HH:mm:ss")
        : "-",
      rightX + 30,
      infoY + 21,
    );

    // -------------------- ตาราง (Table) --------------------
    const tableStartY = infoY + 33;
    let y = tableStartY;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text("ITEMS LIST", leftX, y);

    doc.setFontSize(8);
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y + 5, 180, 8, "F");
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.rect(15, y + 5, 180, 8);

    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "bold");
    doc.text("No.", 17, y + 10);
    doc.text("Code", 24, y + 10);
    doc.text("Product Name", 40, y + 10);
    doc.text("Lot Code", 105, y + 10);
    doc.text("Qty", 127, y + 10);
    doc.text("Production Date", 140, y + 10);
    doc.text("Exp Date", 170, y + 10);

    y += 15;

    transaction.lots.forEach((lot, index) => {
      if (y > 270) {
        doc.addPage();
        y = 22;
        doc.setFillColor(240, 240, 240);
        doc.rect(15, y, 180, 8, "F");
        doc.rect(15, y, 180, 8);
        doc.setFont("helvetica", "bold");
        doc.text("No.", 17, y + 5);
        doc.text("Code", 24, y + 5);
        doc.text("Product Name", 40, y + 5);
        doc.text("Lot Code", 105, y + 5);
        doc.text("Qty", 127, y + 5);
        doc.text("Production Date", 140, y + 5);
        doc.text("Exp Date", 170, y + 5);
        y += 10;
      }

      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(15, y - 3, 180, 8, "F");
      doc.rect(15, y - 3, 180, 8);
      doc.setTextColor(80, 80, 80);
      const centerY = y + 2.5;

      doc.setFont("helvetica", "normal");
      doc.text(String(index + 1), 17, centerY);
      doc.text(lot.productCode || "-", 24, centerY);
      doc.text(lot.lotCode || "-", 105, centerY);
      doc.text(String(lot.quantity), 127, centerY);
      doc.text(
        lot.productionDate
          ? format(new Date(lot.productionDate), "dd/MM/yyyy")
          : "-",
        140,
        centerY,
      );
      doc.text(
        lot.expDate ? format(new Date(lot.expDate), "dd/MM/yyyy") : "-",
        170,
        centerY,
      );

      // จัดการคอลัมน์ Product Name
      const productName = lot.productName || "-";
      const columnWidth = 65; // ความกว้างคอลัมน์ Product Name (จาก x=40 ถึง x=105)
      let xOffset = 40;

      // แยกข้อความเป็นบรรทัดๆ เพื่อให้พอดีกับความกว้าง
      const lines = doc.splitTextToSize(productName, columnWidth);

      lines.forEach((line, lineIndex) => {
        const isKhmer = /[\u1780-\u17FF]/.test(line); // ตรวจจับภาษาเขมร
        if (isKhmer) {
          doc.setFont("KantumruyPro", "normal");
        } else {
          doc.setFont("NotoSansThai", "normal"); // ใช้สำหรับภาษาไทยหรือภาษาอื่น
        }
        doc.text(line, xOffset, centerY + lineIndex * 3); // เพิ่มระยะห่าง 3mm ต่อบรรทัด
      });

      y += 8;
    });

    // -------------------- ส่วนท้าย (Footer) --------------------
    const footerY = 285;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text(
      "Generated on: " + format(new Date(), "dd/MM/yyyy HH:mm:ss"),
      15,
      footerY,
    );
    doc.text("Page " + doc.getCurrentPageInfo().pageNumber, 105, footerY, {
      align: "center",
    });
    doc.text("© Successmore Being Cambodia", 185, footerY, { align: "right" });

    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  };

  //============================
  const exportToExcel = () => {
    const excelData = history.flatMap((transaction) =>
      transaction.lots.map((lot) => ({
        "Date/Time": format(
          new Date(transaction.createdAt),
          "dd/MM/yyyy, HH:mm:ss",
        ),
        "Transaction #": transaction.transactionNumber,
        "Issue Type": transaction.type,
        "Product Code": lot.productCode,
        Product: lot.productName,
        "Lot Code": lot.lotCode,
        User: transaction.userId.username,
        Qty: lot.quantity,
        Warehouse: transaction.warehouseId.name,
        Status: transaction.status,
        "Cancel By": transaction.cancelledBy
          ? transaction.cancelledBy.username || "Unknown"
          : "N/A",
        "Canceled Date": transaction.cancelledDate
          ? format(new Date(transaction.cancelledDate), "dd/MM/yyyy, HH:mm:ss")
          : "N/A",
      })),
    );

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Issue History");
    XLSX.writeFile(workbook, "IssueHistory.xlsx");
  };

  const handleConfirmCancel = (transactionId) => {
    const transaction = history.find((t) => t._id === transactionId);
    if (transaction) {
      setConfirmCancel({
        id: transactionId,
        transactionNumber: transaction.transactionNumber,
        warehouse: transaction.warehouseId.name,
        issueType: transaction.type,
        totalQty: transaction.lots.reduce((sum, l) => sum + l.quantity, 0),
      });
    }
  };

  const closeModal = () => {
    setConfirmCancel(null);
  };

  const clearFilters = async () => {
    const newStartDate = startOfDay(new Date());
    const newEndDate = endOfDay(new Date());

    setFilters((prev) => ({
      ...prev,
      type: "all",
      warehouse: "all",
      status: "all",
      searchUser: "",
      searchTransaction: "",
    }));
    setStartDate(newStartDate);
    setEndDate(newEndDate);

    setIsLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/issue-history`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          startDate: newStartDate.toISOString(),
          endDate: newEndDate.toISOString(),
        },
      });

      const enrichedHistory = await Promise.all(
        data.map(async (transaction) => {
          const lotsWithDetails = await Promise.all(
            transaction.lots.map(async (lot) => {
              try {
                const response = await axios.get(
                  `${API_BASE_URL}/api/lots/${lot.lotId}`,
                  {
                    headers: { Authorization: `Bearer ${token}` },
                  },
                );
                const dbLot = response.data;
                return {
                  ...lot,
                  productCode: dbLot.productId?.productCode || "N/A",
                  productName: dbLot.productId?.name || "N/A",
                  lotCode: dbLot.lotCode || "N/A",
                  productionDate: dbLot.productionDate || null,
                  expDate: dbLot.expDate || null,
                };
              } catch (error) {
                return {
                  ...lot,
                  productCode: "N/A",
                  productName: "N/A",
                  lotCode: "N/A",
                  productionDate: null,
                  expDate: null,
                };
              }
            }),
          );
          return { ...transaction, lots: lotsWithDetails };
        }),
      );

      const sortedHistory = enrichedHistory.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );
      setHistory(sortedHistory);
      setFilteredHistory(sortedHistory);
      setCurrentPage(1);
    } catch (error) {
      toast.error("Failed to load issue history");
    } finally {
      setIsLoading(false);
    }
  };

  const getIssueTypeColor = (type) => {
    const colors = {
      Sale: "bg-blue-100 text-blue-800",
      Waste: "bg-red-100 text-red-800",
      Welfares: "bg-purple-100 text-purple-800",
      Activities: "bg-green-100 text-green-800",
      Transfer: "bg-yellow-100 text-yellow-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  if (!token) return null;

  return (
    <div className="mx-auto max-w-screen-2xl rounded-lg bg-gray-50 p-4 md:p-6">
      <h2 className="mb-6 text-2xl font-bold text-gray-800">Issue History</h2>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-6">
          {/* Filters Section */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Transaction Type
              </label>
              <Select
                value={filters.type}
                onValueChange={(value) =>
                  setFilters({ ...filters, type: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Sale">Sale</SelectItem>
                  <SelectItem value="Waste">Waste</SelectItem>
                  <SelectItem value="Welfares">Welfares</SelectItem>
                  <SelectItem value="Activities">Activities</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Warehouse filter: admin เท่านั้นที่เลือกได้ */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Warehouse
              </label>
              {user && user.role === "admin" ? (
                <Select
                  value={filters.warehouse}
                  onValueChange={(value) =>
                    setFilters({ ...filters, warehouse: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Warehouses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Warehouses</SelectItem>
                    {warehouses.map((w) => (
                      <SelectItem key={w._id} value={w._id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={
                    warehouses.find((w) => w._id === filters.warehouse)?.name ||
                    ""
                  }
                  disabled
                  className="w-full bg-gray-100"
                />
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Status
              </label>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Cancelled">Cancel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(startOfDay(date))}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                dateFormat="dd/MM/yyyy"
                className="w-full rounded-md border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                End Date
              </label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(endOfDay(date))}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate}
                dateFormat="dd/MM/yyyy"
                className="w-full rounded-md border p-2"
              />
            </div>
          </div>

          {/* Search Section */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Search User
              </label>
              <Input
                type="text"
                placeholder="Search by username..."
                value={filters.searchUser}
                onChange={(e) =>
                  setFilters({ ...filters, searchUser: e.target.value })
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Search Transaction
              </label>
              <Input
                type="text"
                placeholder="Search by transaction #..."
                value={filters.searchTransaction}
                onChange={(e) =>
                  setFilters({ ...filters, searchTransaction: e.target.value })
                }
              />
            </div>

            <div className="flex items-end space-x-2">
              <Button
                onClick={fetchData}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Apply Filters
              </Button>
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
              <Button
                onClick={exportToExcel}
                className="ml-auto bg-green-600 hover:bg-green-700"
              >
                Export Excel
              </Button>
            </div>
          </div>

          {/* Table Section */}
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Transaction #</TableHead>
                  <TableHead>Issue Type</TableHead>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Total Qty</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cancel By</TableHead>
                  <TableHead>Canceled Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.length > 0 ? (
                  currentItems.map((transaction) => (
                    <TableRow key={transaction._id}>
                      <TableCell className="font-medium">
                        {transaction.transactionNumber}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${getIssueTypeColor(transaction.type)}`}
                        >
                          {transaction.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        {format(
                          new Date(transaction.createdAt),
                          "dd-MM-yyyy, HH:mm:ss",
                        )}
                      </TableCell>
                      <TableCell>{transaction.userId.username}</TableCell>
                      <TableCell>
                        {transaction.lots.reduce(
                          (sum, l) => sum + l.quantity,
                          0,
                        )}
                      </TableCell>
                      <TableCell>{transaction.warehouseId.name}</TableCell>
                      <TableCell
                        className={
                          transaction.status === "Active"
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {transaction.status}
                      </TableCell>
                      <TableCell>
                        {transaction.cancelledBy
                          ? transaction.cancelledBy.username || "-"
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {transaction.cancelledDate
                          ? format(
                              new Date(transaction.cancelledDate),
                              "dd-MM-yyyy, HH:mm:ss",
                            )
                          : "-"}
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generatePDF(transaction)}
                        >
                          View PDF
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleConfirmCancel(transaction._id)}
                          disabled={
                            !userId ||
                            !user ||
                            user.role !== "admin" ||
                            transaction.status !== "Active"
                          }
                        >
                          Cancel
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="py-4 text-center">
                      No transactions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {filteredHistory.length > itemsPerPage && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {indexOfFirstItem + 1} to{" "}
                {Math.min(indexOfLastItem, filteredHistory.length)} of{" "}
                {filteredHistory.length} results
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                    >
                      Previous
                    </PaginationPrevious>
                  </PaginationItem>

                  {Array.from({ length: totalPages }, (_, i) => {
                    const pageNum = i + 1;
                    if (totalPages > 5) {
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= currentPage - 1 &&
                          pageNum <= currentPage + 1)
                      ) {
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              isActive={currentPage === pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum === currentPage - 1 && currentPage > 2
                                ? "..."
                                : ""}
                              {pageNum}
                              {pageNum === currentPage + 1 &&
                              currentPage < totalPages - 1
                                ? "..."
                                : ""}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }
                      return null;
                    }
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          isActive={currentPage === pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </PaginationNext>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}

      {confirmCancel && (
        <Dialog open={true} onOpenChange={closeModal}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Confirm Cancel Transaction</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Transaction #
                  </p>
                  <p>{confirmCancel.transactionNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Warehouse</p>
                  <p>{confirmCancel.warehouse}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Issue Type
                  </p>
                  <p>{confirmCancel.issueType}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Qty</p>
                  <p>{confirmCancel.totalQty}</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  handleCancel(confirmCancel.id);
                  closeModal();
                }}
              >
                Confirm Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default IssueHistory;
