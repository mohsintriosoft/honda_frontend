import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    server_post_json,
    register_user_email,
    setAuthSession,
} from "@/components/ServiceConnection/serviceconnection";

interface FormState {
    dealerName: string;
    city: string;
    fullName: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
}

const initialState: FormState = {
    dealerName: "",
    city: "",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
};

export default function Register() {
    const navigate = useNavigate();

    const [form, setForm] = useState<FormState>(initialState);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value }));

    const validate = (): string | null => {
        if (!form.dealerName.trim()) return "Enter your dealership or company name.";
        if (!form.fullName.trim()) return "Enter your full name.";
        if (!form.email.trim()) return "Enter a work email.";
        if (form.password.length < 8) return "Password must be at least 8 characters.";
        if (form.password !== form.confirmPassword) return "Passwords don't match.";
        return null;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);
        setLoading(true);

        try {
            // Creates the Dealer + the first StaffUser (role: owner) in one call.
            // Confirm the exact field names/shape against the backend once
            // register_user_email lands in views_admin.py.
            const response = await server_post_json(register_user_email, {
                dealer_name: form.dealerName.trim(),
                city: form.city.trim(),
                name: form.fullName.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                password: form.password,
            });

            const accessToken = response?.access_token ?? response?.token;

            if (!accessToken) {
                throw new Error(response?.error || "No access token returned");
            }

            setAuthSession(accessToken, response?.user ?? null);
            navigate("/dashboard", { replace: true });
        } catch (err: any) {
            const serverMessage = err?.response?.data?.error || err?.response?.data?.message;
            setError(serverMessage || "We couldn't create your account. Please try again.");
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
                        Set up your workspace in minutes.
                    </h2>
                    <p className="mt-3 text-sm text-sidebar-foreground/70">
                        Add your branches, connect your CRM data, and your AI agents are ready to call, book,
                        and follow up — 24/7.
                    </p>
                </div>

                <p className="text-xs text-sidebar-foreground/50">
                    © {new Date().getFullYear()} Triosoft. All rights reserved.
                </p>
            </div>

            {/* Form side */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
                <div className="w-full max-w-sm py-8">
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

                    <h1 className="text-2xl font-display font-semibold tracking-tight">Create your account</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        You'll be the owner of this workspace and can invite your team afterwards.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5 col-span-2">
                                <Label htmlFor="dealerName">Dealership / company name</Label>
                                <Input
                                    id="dealerName"
                                    placeholder="Om Honda"
                                    value={form.dealerName}
                                    onChange={update("dealerName")}
                                    disabled={loading}
                                />
                            </div>

                            <div className="space-y-1.5 col-span-2">
                                <Label htmlFor="city">City</Label>
                                <Input
                                    id="city"
                                    placeholder="Bhopal"
                                    value={form.city}
                                    onChange={update("city")}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="h-px bg-border" />

                        <div className="space-y-1.5">
                            <Label htmlFor="fullName">Your full name</Label>
                            <Input
                                id="fullName"
                                placeholder="Rajesh Saini"
                                value={form.fullName}
                                onChange={update("fullName")}
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="email">Work email</Label>
                            <Input
                                id="email"
                                type="email"
                                autoComplete="email"
                                placeholder="you@dealership.com"
                                value={form.email}
                                onChange={update("email")}
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="98XXXXXX00"
                                value={form.phone}
                                onChange={update("phone")}
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    placeholder="At least 8 characters"
                                    value={form.password}
                                    onChange={update("password")}
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

                        <div className="space-y-1.5">
                            <Label htmlFor="confirmPassword">Confirm password</Label>
                            <Input
                                id="confirmPassword"
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                placeholder="Re-enter your password"
                                value={form.confirmPassword}
                                onChange={update("confirmPassword")}
                                disabled={loading}
                            />
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
                                    Creating account…
                                </>
                            ) : (
                                <>
                                    Create account
                                    <ArrowRight className="size-4" />
                                </>
                            )}
                        </Button>
                    </form>

                    <p className="mt-6 text-center text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link to="/login" className="font-medium text-foreground hover:underline">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}