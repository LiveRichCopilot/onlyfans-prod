import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-white">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px]" />

      <Suspense
        fallback={
          <div className="glass-panel p-10 rounded-3xl z-10 w-full max-w-md border-white/10 mx-4 text-center">
            <h1 className="text-3xl font-bold mb-2 tracking-tight">OF HQ</h1>
            <p className="text-white/50">Loading...</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
