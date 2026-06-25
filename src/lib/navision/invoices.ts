import mssql from "mssql";
import { dateToIso, toNumber } from "@/lib/customs/normalize";
import { getNavPool, getNavTableColumns, navTable, optionalColumnExpression } from "@/lib/navision/client";

export interface NavInvoiceHeader {
  documentNo: string;
  postingDate: string | null;
  billToCustomerNo: string | null;
  sellToCustomerNo: string | null;
  customerName: string | null;
  customerVatNo: string | null;
  customerAddress: string | null;
  customerAddress2: string | null;
  customerPostCode: string | null;
  customerCity: string | null;
  customerProvince: string | null;
  customerCountryRegionCode: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  currencyCode: string | null;
  totalAmount: number;
  totalAmountIncludingVat: number;
  shipmentMethod: string | null;
  shippingAgent: string | null;
  externalDocumentNo: string | null;
}

export interface NavInvoiceLine {
  documentNo: string;
  lineNo: number;
  type: number | null;
  no: string | null;
  isbn: string | null;
  description: string | null;
  description2: string | null;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  amountIncludingVat: number;
  vatPercent: number | null;
  netWeightKg: number | null;
  grossWeightKg: number | null;
}

export interface NavInvoice {
  header: NavInvoiceHeader;
  lines: NavInvoiceLine[];
  productLines: NavInvoiceLine[];
  customsText: string;
}

function nullableString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function mapHeader(row: Record<string, unknown>): NavInvoiceHeader {
  return {
    documentNo: String(row.document_no),
    postingDate: dateToIso(row.posting_date),
    billToCustomerNo: nullableString(row.bill_to_customer_no),
    sellToCustomerNo: nullableString(row.sell_to_customer_no),
    customerName: nullableString(row.customer_name),
    customerVatNo: nullableString(row.customer_vat_no),
    customerAddress: nullableString(row.customer_address),
    customerAddress2: nullableString(row.customer_address_2),
    customerPostCode: nullableString(row.customer_post_code),
    customerCity: nullableString(row.customer_city),
    customerProvince: nullableString(row.customer_province),
    customerCountryRegionCode: nullableString(row.customer_country_region_code),
    customerPhone: nullableString(row.customer_phone),
    customerEmail: nullableString(row.customer_email),
    currencyCode: nullableString(row.currency_code) || "EUR",
    totalAmount: toNumber(row.total_amount),
    totalAmountIncludingVat: toNumber(row.total_amount_including_vat),
    shipmentMethod: nullableString(row.shipment_method),
    shippingAgent: nullableString(row.shipping_agent),
    externalDocumentNo: nullableString(row.external_document_no),
  };
}

function mapLine(row: Record<string, unknown>): NavInvoiceLine {
  return {
    documentNo: String(row.document_no),
    lineNo: Number(row.line_no),
    type: row.type === null || row.type === undefined ? null : Number(row.type),
    no: nullableString(row.no),
    isbn: nullableString(row.isbn),
    description: nullableString(row.description),
    description2: nullableString(row.description_2),
    quantity: toNumber(row.quantity),
    unitPrice: toNumber(row.unit_price),
    lineAmount: toNumber(row.line_amount),
    amountIncludingVat: toNumber(row.amount_including_vat),
    vatPercent: row.vat_percent === null || row.vat_percent === undefined ? null : toNumber(row.vat_percent),
    netWeightKg: row.net_weight_kg === null || row.net_weight_kg === undefined ? null : toNumber(row.net_weight_kg),
    grossWeightKg: row.gross_weight_kg === null || row.gross_weight_kg === undefined ? null : toNumber(row.gross_weight_kg),
  };
}

function isProductLine(line: NavInvoiceLine) {
  return line.type === 2 || (Boolean(line.no) && line.quantity > 0);
}

export async function getNavInvoiceByDocumentNo(documentNo: string): Promise<NavInvoice | null> {
  const pool = await getNavPool();
  const [headerColumns, lineColumns, itemColumns, customerColumns] = await Promise.all([
    getNavTableColumns("Sales Invoice Header"),
    getNavTableColumns("Sales Invoice Line"),
    getNavTableColumns("Item"),
    getNavTableColumns("Customer"),
  ]);
  const headerOptional = [
    optionalColumnExpression("h", headerColumns, ["VAT Registration No_"], "customer_vat_no"),
    optionalColumnExpression("c", customerColumns, ["Phone No_", "Phone No"], "customer_phone"),
    optionalColumnExpression("c", customerColumns, ["E-Mail", "E Mail", "Email"], "customer_email"),
  ].join(",\n      ");

  const headerResult = await pool.request()
    .input("documentNo", mssql.NVarChar, documentNo)
    .query(`
      SELECT TOP (1)
        h.[No_] AS document_no,
        h.[Posting Date] AS posting_date,
        h.[Bill-to Customer No_] AS bill_to_customer_no,
        h.[Sell-to Customer No_] AS sell_to_customer_no,
        h.[Bill-to Name] AS customer_name,
        h.[Bill-to Address] AS customer_address,
        h.[Bill-to Address 2] AS customer_address_2,
        h.[Bill-to Post Code] AS customer_post_code,
        h.[Bill-to City] AS customer_city,
        h.[Bill-to County] AS customer_province,
        h.[Bill-to Country_Region Code] AS customer_country_region_code,
        h.[Currency Code] AS currency_code,
        h.[Shipment Method Code] AS shipment_method,
        h.[Shipping Agent Code] AS shipping_agent,
        h.[External Document No_] AS external_document_no,
        COALESCE(SUM(l.[Amount]), 0) AS total_amount,
        COALESCE(SUM(l.[Amount Including VAT]), 0) AS total_amount_including_vat,
        ${headerOptional}
      FROM ${navTable("Sales Invoice Header")} h
      LEFT JOIN ${navTable("Sales Invoice Line")} l ON l.[Document No_] = h.[No_]
      LEFT JOIN ${navTable("Customer")} c ON c.[No_] = h.[Bill-to Customer No_]
      WHERE h.[No_] = @documentNo
      GROUP BY h.[No_], h.[Posting Date], h.[Bill-to Customer No_], h.[Sell-to Customer No_],
        h.[Bill-to Name], h.[Bill-to Address], h.[Bill-to Address 2],
        h.[Bill-to Post Code], h.[Bill-to City], h.[Bill-to County],
        h.[Bill-to Country_Region Code], h.[Currency Code], h.[Shipment Method Code],
        h.[Shipping Agent Code], h.[External Document No_],
        ${["VAT Registration No_"].filter((column) => headerColumns.has(column)).map((column) => `h.[${column}]`).join(", ") || "h.[No_]"},
        ${["Phone No_", "Phone No"].filter((column) => customerColumns.has(column)).map((column) => `c.[${column}]`).join(", ") || "c.[No_]"},
        ${["E-Mail", "E Mail", "Email"].filter((column) => customerColumns.has(column)).map((column) => `c.[${column}]`).join(", ") || "c.[No_]"}
    `);
  const headerRow = headerResult.recordset[0] as Record<string, unknown> | undefined;
  if (!headerRow) return null;

  const lineOptional = [
    optionalColumnExpression("l", lineColumns, ["VAT %", "VAT Percent"], "vat_percent", "decimal(18,3)"),
    optionalColumnExpression("l", lineColumns, ["Net Weight", "Peso neto"], "line_net_weight", "decimal(18,3)"),
    optionalColumnExpression("l", lineColumns, ["Gross Weight", "Peso bruto"], "line_gross_weight", "decimal(18,3)"),
    optionalColumnExpression("i", itemColumns, ["ISBN", "ISBN-13", "ISBN 13", "EAN", "EAN13"], "item_isbn"),
    optionalColumnExpression("i", itemColumns, ["Net Weight", "Peso neto"], "item_net_weight", "decimal(18,3)"),
    optionalColumnExpression("i", itemColumns, ["Gross Weight", "Peso bruto"], "item_gross_weight", "decimal(18,3)"),
  ].join(",\n        ");
  const linesResult = await pool.request()
    .input("documentNo", mssql.NVarChar, documentNo)
    .query(`
      SELECT TOP (500)
        l.[Document No_] AS document_no,
        l.[Line No_] AS line_no,
        l.[Type] AS type,
        l.[No_] AS no,
        l.[Description] AS description,
        l.[Description 2] AS description_2,
        l.[Quantity] AS quantity,
        l.[Unit Price] AS unit_price,
        l.[Line Amount] AS line_amount,
        l.[Amount Including VAT] AS amount_including_vat,
        ${lineOptional}
      FROM ${navTable("Sales Invoice Line")} l
      LEFT JOIN ${navTable("Item")} i ON i.[No_] = l.[No_]
      WHERE l.[Document No_] = @documentNo
      ORDER BY l.[Line No_]
    `);
  const lines = linesResult.recordset.map((row) => {
    const record = row as Record<string, unknown>;
    record.isbn = record.item_isbn;
    record.net_weight_kg = record.line_net_weight ?? record.item_net_weight;
    record.gross_weight_kg = record.line_gross_weight ?? record.item_gross_weight;
    return mapLine(record);
  });
  const productLines = lines.filter(isProductLine);
  const customsText = lines
    .filter((line) => !isProductLine(line))
    .map((line) => [line.description, line.description2].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n");

  return {
    header: mapHeader(headerRow),
    lines,
    productLines,
    customsText,
  };
}
