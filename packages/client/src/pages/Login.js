import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ============================================
// NS LUXURY VILLA — Login Page
// Authentication with 2FA TOTP support & error feedback
// ============================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiFetch, ApiClientError } from '../services/api';
import { ShieldCheck, KeyRound, User, Lock, ArrowRight } from 'lucide-react';
export const Login = () => {
    const navigate = useNavigate();
    const setAuth = useAuthStore((state) => state.setAuth);
    const [loginInput, setLoginInput] = useState('');
    const [password, setPassword] = useState('');
    const [totpCode, setTotpCode] = useState('');
    const [requires2FA, setRequires2FA] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const data = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    login: loginInput,
                    password,
                    ...(requires2FA ? { totpCode } : {}),
                }),
            });
            if (data.requiresTwoFactor) {
                setRequires2FA(true);
                setIsLoading(false);
                return;
            }
            if (data.user && data.tokens) {
                setAuth(data.user, data.tokens);
                navigate('/dashboard', { replace: true });
            }
        }
        catch (err) {
            if (err instanceof ApiClientError) {
                setErrorMsg(err.message);
            }
            else {
                setErrorMsg('Unable to connect to server. Please try again.');
            }
        }
        finally {
            setIsLoading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen w-screen bg-[#0F141C] flex items-center justify-center p-4 select-none", children: _jsxs("div", { className: "w-full max-w-md bg-[#151C28] border border-[#2D3748] rounded-2xl shadow-2xl overflow-hidden", children: [_jsxs("div", { className: "bg-[#8C2D19] p-6 text-center border-b border-[#C49A45]/30", children: [_jsx("div", { className: "w-14 h-14 bg-[#151C28] rounded-2xl mx-auto flex items-center justify-center text-[#E2B768] mb-3 shadow-lg border border-[#C49A45]/40", children: _jsx(ShieldCheck, { size: 28 }) }), _jsx("h1", { className: "text-xl font-bold text-white tracking-wide font-['Outfit']", children: "NS LUXURY VILLA" }), _jsx("p", { className: "text-xs text-[#E2B768] font-medium mt-1", children: "Management System \u00B7 Ho, Ghana" })] }), _jsxs("div", { className: "p-8", children: [_jsxs("div", { className: "mb-6 text-center", children: [_jsx("h2", { className: "text-base font-semibold text-[#F3F4F6]", children: requires2FA ? 'Two-Factor Authentication' : 'Staff Access Sign In' }), _jsx("p", { className: "text-xs text-[#9CA3AF] mt-1", children: requires2FA
                                        ? 'Enter the 6-digit code from your authenticator app'
                                        : 'Enter your credentials to access the management platform' })] }), errorMsg && (_jsx("div", { className: "mb-6 p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-xs text-[#EF4444] text-center font-medium", children: errorMsg })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [!requires2FA ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-[#9CA3AF] mb-1.5", children: "Username or Email" }), _jsxs("div", { className: "relative", children: [_jsx(User, { size: 16, className: "absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]" }), _jsx("input", { type: "text", required: true, value: loginInput, onChange: (e) => setLoginInput(e.target.value), placeholder: "admin or email@nsvilla.com", className: "w-full bg-[#121824] border border-[#2D3748] rounded-lg pl-10 pr-4 py-2.5 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-[#C49A45] transition-colors" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-[#9CA3AF] mb-1.5", children: "Password" }), _jsxs("div", { className: "relative", children: [_jsx(Lock, { size: 16, className: "absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]" }), _jsx("input", { type: "password", required: true, value: password, onChange: (e) => setPassword(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", className: "w-full bg-[#121824] border border-[#2D3748] rounded-lg pl-10 pr-4 py-2.5 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-[#C49A45] transition-colors" })] })] })] })) : (
                                /* 2FA Code Input */
                                _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-[#9CA3AF] mb-1.5 text-center", children: "6-Digit Authenticator Code" }), _jsxs("div", { className: "relative", children: [_jsx(KeyRound, { size: 16, className: "absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]" }), _jsx("input", { type: "text", required: true, maxLength: 6, value: totpCode, onChange: (e) => setTotpCode(e.target.value.replace(/\D/g, '')), placeholder: "000000", className: "w-full bg-[#121824] border border-[#2D3748] rounded-lg pl-10 pr-4 py-2.5 text-center font-mono text-lg tracking-widest text-[#F3F4F6] focus:outline-none focus:border-[#C49A45] transition-colors" })] })] })), _jsx("button", { type: "submit", disabled: isLoading, className: "w-full mt-2 bg-[#8C2D19] hover:bg-[#732212] text-white font-semibold text-xs py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50", children: isLoading ? ('Authenticating...') : (_jsxs(_Fragment, { children: [requires2FA ? 'Verify Code' : 'Sign In to Workspace', _jsx(ArrowRight, { size: 14 })] })) })] }), _jsxs("div", { className: "mt-8 pt-4 border-t border-[#2D3748]/50 text-center", children: [_jsx("p", { className: "text-[11px] text-[#6B7280]", children: "Authorized personnel only. All access attempts are audited." }), _jsx("p", { className: "text-[10px] text-[#E2B768] mt-0.5", children: "NS Luxury Villa \u00B7 Ho, Volta Region, Ghana" })] })] })] }) }));
};
