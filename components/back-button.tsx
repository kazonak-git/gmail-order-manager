"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="w-9 h-9 rounded-xl bg-white border border-border/60 flex items-center justify-center text-muted-foreground hover:text-[#2A2A2A] transition-colors shadow-sm mt-1"
    >
      <ArrowLeft className="w-4 h-4" />
    </button>
  );
}
