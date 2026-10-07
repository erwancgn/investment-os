"use client";

import React from "react";
import { shouldScrollNotionTable } from "../lib/table-presentation";
import type { InlineSegment } from "../../core/contracts/analysis";

function looksNumeric(value: string) {
  return /(?:^|\s)[+−-]?[\d\s.,≈]+\s*(?:%|€|\$|£|JPY|USD|EUR|x)?\s*$/i.test(value.trim());
}

/** A table is structural content; only dense tables receive an accessible scroll region. */
export function NotionTable<Cell extends string | InlineSegment[]>({ rows, header = true, renderCell }: { rows: Cell[][]; header?: boolean; renderCell: (value: Cell) => React.ReactNode }) {
  if (!rows.length) return null;
  const textRows = rows.map(row => row.map(cell => typeof cell === "string" ? cell : cell.map(segment => segment.text).join("")));
  const columnCount = Math.max(...rows.map(row => row.length), 1);
  const scrollable = shouldScrollNotionTable(textRows);
  const columnClass = columnCount === 2 ? " notion-table-two-column" : "";
  const renderRow = (row: Cell[], rowIndex: number, headerRow = false) => <tr key={rowIndex}>{row.map((cell, cellIndex) => {
    const HeaderOrCell = headerRow ? "th" : "td";
    return <HeaderOrCell scope={headerRow ? "col" : undefined} className={looksNumeric(textRows[rowIndex][cellIndex]) ? "notion-table-numeric" : undefined} key={cellIndex}>{renderCell(cell)}</HeaderOrCell>;
  })}</tr>;
  const bodyRows = header ? rows.slice(1) : rows;
  const table = <table className={`notion-table${scrollable ? " notion-table-wide" : " notion-table-compact"}${columnClass}`}>{header && <thead>{renderRow(rows[0], 0, true)}</thead>}<tbody>{bodyRows.map((row, rowIndex) => renderRow(row, header ? rowIndex + 1 : rowIndex))}</tbody></table>;
  const wrapperProps = {
    className: `notion-table-wrap${scrollable ? " notion-table-wrap-scrollable" : ""}`,
    style: { "--notion-columns": columnCount } as React.CSSProperties,
    tabIndex: scrollable ? 0 : undefined,
    role: scrollable ? "region" : undefined,
    "aria-label": scrollable ? "Tableau défilable horizontalement" : undefined,
  };
  return <div {...wrapperProps}>{table}</div>;
}
