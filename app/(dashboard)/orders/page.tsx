import { OrdersTable } from "@/components/orders-table";

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#2A2A2A]">Rendelések</h1>
        <p className="text-sm text-muted-foreground mt-1">Az összes megtalált Gmail rendelés listája.</p>
      </div>
      <OrdersTable />
    </div>
  );
}
