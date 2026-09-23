import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    server_post_json,
    login_user_email,
    setAuthSession,
} from "@/components/ServiceConnection/serviceconnection";

export default function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email.trim() || !password) {
            setError("Enter your email and password to continue.");
            return;
        }

        setLoading(true);

        try {
            // Expected shape: { access_token, user: { name, email, role, ... } }
            // Adjust the destructure below once the real login_user_email
            // response shape is confirmed against views_admin.py.
            const response = await server_post_json(login_user_email, {
                email: email.trim(),
                password,
            });

            const accessToken = response?.access_token ?? response?.token;

            if (!accessToken) {
                throw new Error(response?.error || "No access token returned");
            }

            setAuthSession(accessToken, response?.user ?? null);
            navigate("/dashboard", { replace: true });
        } catch (err: any) {
            const serverMessage = err?.response?.data?.error || err?.response?.data?.message;
            setError(serverMessage || "That email and password combination didn't work.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-background text-foreground">
            {/* Brand side */}
            <div className="hidden lg:flex lg:w-[42%] flex-col justify-between bg-sidebar text-sidebar-foreground p-10 border-r">
                <div className="flex items-center gap-2">
                    <div className="size-8 rounded-md bg-gradient-to-br from-primary to-[color:var(--ai)] grid place-items-center text-primary-foreground font-display font-bold">
                        T
                    </div>
                    <div className="leading-tight">
                        <div className="text-sm font-semibold font-display">Triosoft</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            AI Lifecycle OS
                        </div>
                    </div>
                </div>

                <div className="max-w-sm">
                    <h2 className="text-2xl font-display font-semibold leading-snug">
                        Every customer conversation, one console.
                    </h2>
                    <p className="mt-3 text-sm text-sidebar-foreground/70">
                        Voice, WhatsApp, and campaign performance for your dealership — run by AI agents your
                        team can see, tune, and trust.
                    </p>
                </div>

                <p className="text-xs text-sidebar-foreground/50">
                    © {new Date().getFullYear()} Triosoft. All rights reserved.
                </p>
            </div>

            {/* Form side */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-sm">
                    <div className="lg:hidden flex items-center gap-2 mb-8">
                        <div className="size-8 rounded-md bg-gradient-to-br from-primary to-[color:var(--ai)] grid place-items-center text-primary-foreground font-display font-bold">
                            T
                        </div>
                        <div className="leading-tight">
                            <div className="text-sm font-semibold font-display">Triosoft</div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                AI Lifecycle OS
                            </div>
                        </div>
                    </div>

                    <h1 className="text-2xl font-display font-semibold tracking-tight">Sign in</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Welcome back. Enter your details to access your workspace.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email">Work email</Label>
                            <Input
                                id="email"
                                type="email"
                                autoComplete="email"
                                placeholder="you@dealership.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                                <button
                                    type="button"
                                    className="text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => setError("Ask your dealer admin to reset your password for now.")}
                                >
                                    Forgot password?
                                </button>
                            </div>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Signing in…
                                </>
                            ) : (
                                <>
                                    Sign in
                                    <ArrowRight className="size-4" />
                                </>
                            )}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}