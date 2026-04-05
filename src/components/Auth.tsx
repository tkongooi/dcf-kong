import React, { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { User, LogIn, LogOut, Mail, Loader2, AlertTriangle, KeyRound } from "lucide-react";

export const AuthUI = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [user, setUser] = useState<any>(null);
  const [showOtpInput, setShowOtpInput] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100 text-[10px] font-bold">
        <AlertTriangle className="h-3 w-3" />
        SUPABASE KEYS MISSING
      </div>
    );
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      alert(error.message);
    } else {
      setShowOtpInput(true);
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email'
    });

    if (error) {
      alert("Invalid code: " + error.message);
    } else {
      setShowOtpInput(false);
      setOtp("");
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowOtpInput(false);
    setEmail("");
  };

  if (user) {
    return (
      <div className="flex items-center gap-4 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="h-3 w-3 text-blue-600" />
          </div>
          <span className="text-xs font-medium text-slate-600 truncate max-w-[120px]">
            {user.email}
          </span>
        </div>
        <button 
          onClick={handleLogout}
          className="p-1 hover:bg-slate-50 rounded-full transition-colors text-slate-400 hover:text-red-500"
          title="Sign Out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {showOtpInput ? (
        <form onSubmit={handleVerifyOtp} className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Enter code from email"
              className="pl-8 pr-4 py-1.5 bg-white border border-green-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500 w-48"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
            <KeyRound className="absolute left-2.5 top-2 h-3.5 w-3.5 text-green-600" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-sm"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSendOtp} className="flex items-center gap-2">
          <div className="relative">
            <input
              type="email"
              placeholder="Enter your email"
              className="pl-8 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Mail className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-sm"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogIn className="h-3 w-3" />}
            Login
          </button>
        </form>
      )}
    </div>
  );
};
