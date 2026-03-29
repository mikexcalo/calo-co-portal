'use client';

import React from 'react';

export interface DataTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  mono?: boolean;
}

export interface DataTableProps {
  columns: DataTableColumn[];
  data: any[];
  className?: string;
  rowClassName?: string;
  onRowClick?: (row: any, index: number) => void;
  children?: React.ReactNode;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  className = '',
  rowClassName = '',
  onRowClick,
  children,
}) => {
  return (
    <table className={`data-table ${className}`}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              className={col.align === 'right' ? 'r' : ''}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr
            key={rowIndex}
            className={`${onRowClick ? 'inv-row' : ''} ${rowClassName}`}
            onClick={() => onRowClick?.(row, rowIndex)}
          >
            {columns.map((col) => (
              <td
                key={`${rowIndex}-${col.key}`}
                className={`${col.align === 'right' ? 'r' : ''} ${col.mono ? 'mono' : ''}`}
              >
                {row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {children}
    </table>
  );
};

DataTable.displayName = 'DataTable';
