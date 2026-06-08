import { LoginButton } from "@/components/login-button";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #b8d8ba 0%, #d4c5a9 50%, #f0d5c8 100%)" }}
    >
      {/* Háttér díszkörök — a mockup pill/blob stílusa */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #7BB27E 0%, transparent 70%)" }} />
        <div className="absolute top-1/4 right-[-60px] w-56 h-56 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #c8a97e 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-60px] left-1/3 w-64 h-64 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, #7BB27E 0%, transparent 70%)" }} />
        <div className="absolute top-1/2 left-1/4 w-40 h-40 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #e8c5a0 0%, transparent 70%)" }} />
      </div>

      {/* Főtartalom */}
      <div className="relative z-10 flex flex-col items-start px-10 max-w-sm w-full">
        {/* Cím — a mockup nagy, félkövér stílusa */}
        <div className="mb-10">
          <h1 className="text-5xl font-black leading-tight text-[#2A2A2A] uppercase tracking-tight">
            HELPING YOU<br />
            MANAGE<br />
            <span className="text-[#7BB27E] italic">YOUR ORDERS</span><br />
            EVERY DAY
          </h1>
        </div>

        {/* Kártya */}
        <div className="w-full bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-soft">
          <p className="text-sm text-gray-500 mb-5 leading-relaxed">
            Csatlakoztasd Gmail-fiókodat és automatikusan rendszerezd az online rendeléseidet.
          </p>
          <LoginButton />
          <p className="text-xs text-gray-400 mt-4 text-center">
            Csak olvasási hozzáférést kérünk a levelekhez.
          </p>
        </div>
      </div>
    </div>
  );
}
