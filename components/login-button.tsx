"use client";

import { signIn } from "next-auth/react";

export function LoginButton() {
  return (
    <button
      onClick={() => signIn("google", { callbackUrl: "/" })}
      className="w-full flex items-center justify-between bg-[#2A2A2A] text-white rounded-full px-6 py-4 font-semibold text-base hover:bg-[#3a3a3a] transition-colors group"
    >
      <span>Get Started</span>
      <span className="w-9 h-9 bg-white rounded-full flex items-center justify-center flex-shrink-0">
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
          <path d="M4 10h12M12 6l4 4-4 4" stroke="#2A2A2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
