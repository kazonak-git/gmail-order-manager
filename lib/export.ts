import * as XLSX from "xlsx";
import type { Order } from "@/types/database";

export function generateExcel(orders: Order[]): Buffer {
  const rows = orders.map((o) => ({
    "Rendelésszám": o.order_number ?? "",
    "Dátum": o.order_date ? new Date(o.order_date).toLocaleDateString("hu-HU") : "",
    "Vásárló neve": o.customer_name ?? "",
    "Vásárló emailje": o.customer_email ?? "",
    "Végösszeg": o.total_amount ?? "",
    "Pénznem": o.currency ?? "HUF",
    "Státusz": o.status,
    "Fizetési mód": o.payment_method ?? "",
    "Szállítási cím": formatAddress(o.shipping_address),
    "Termékek": formatItems(o.items),
    "Forrás": o.source_sender ?? "",
    "Email tárgy": o.raw_email_subject ?? "",
    "Létrehozva": new Date(o.created_at).toLocaleDateString("hu-HU"),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rendelések");

  // Oszlopszélességek
  ws["!cols"] = [
    { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 30 },
    { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 14 },
    { wch: 35 }, { wch: 40 }, { wch: 30 }, { wch: 40 }, { wch: 12 },
  ];

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function formatAddress(addr: Order["shipping_address"]): string {
  if (!addr) return "";
  return [addr.zip, addr.city, addr.street].filter(Boolean).join(", ");
}

function formatItems(items: Order["items"]): string {
  if (!items || items.length === 0) return "";
  return items
    .map((i) => `${i.name} (${i.quantity}x ${i.unit_price} ${""})`)
    .join("; ");
}
