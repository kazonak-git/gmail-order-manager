import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen bg-[#F6F6F6]">
      <Sidebar user={session.user} />
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="p-4 md:p-7 max-w-6xl mx-auto">{children}</div>
      </main>
      <MobileNav />
    </div>
  );
}
