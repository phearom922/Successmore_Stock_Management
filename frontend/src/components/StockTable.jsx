import React from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from '@/components/ui/pagination';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { format } from 'date-fns';

const StockTable = ({
  data = [],
  sortConfig,
  requestSort,
  handlePageChange,
  currentPage,
  totalPages,
  isAllStock,
  isLowStock,
  isExpiringSoon,
  isDamaged
}) => {
  // Determine columns based on tab
  let columns = [
    { key: 'lotCode', label: 'Lot Code' },
    { key: 'productId.name', label: 'Product Name' },
    { key: 'productId.productCode', label: 'Product Code' },
    { key: 'warehouse', label: 'Warehouse' },
  ];
  if (isAllStock) {
    columns.push(
      { key: 'qtyOnHand', label: 'Quantity' },
      { key: 'damaged', label: 'Damaged' },
      { key: 'expDate', label: 'Expiration' }
    );
  } else if (isLowStock) {
    columns.push(
      { key: 'qtyOnHand', label: 'Quantity' }
    );
  } else if (isExpiringSoon) {
    columns.push(
      { key: 'expDate', label: 'Expiration' }
    );
  } else if (isDamaged) {
    columns.push(
      { key: 'damaged', label: 'Damaged' }
    );
  }

  const getValue = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : ''), obj);

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead
                  key={col.key}
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => requestSort(col.key)}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    {sortConfig.key === col.key ? (
                      sortConfig.direction === 'ascending' ? <FaSortUp /> : <FaSortDown />
                    ) : <FaSort className="text-gray-400" />}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-gray-400">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              data.map(lot => (
                <TableRow key={lot._id} className="hover:bg-gray-50">
                  {columns.map(col => (
                    <TableCell key={col.key} className={col.key === 'lotCode' ? 'font-medium' : ''}>
                      {col.key === 'expDate'
                        ? (lot.expDate ? format(new Date(lot.expDate), 'dd-MM-yyyy') : 'N/A')
                        : getValue(lot, col.key) || 0}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            />
          </PaginationItem>
          <PaginationItem>
            <span className="px-4 py-2 text-sm">
              Page {currentPage} of {totalPages}
            </span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </>
  );
};

export default StockTable;
