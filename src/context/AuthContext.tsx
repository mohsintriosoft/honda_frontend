import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import {
    server_get_data,
    setAuthSession as persistAuthSession,
    getStaffUser,
    clearAuthSession as clearPersistedAuthSession,
    isAuthenticated as hasPersistedToken,
    getAccessToken,
    APL_LINK,
} from "@/components/ServiceConnection/serviceconnection";

// GET /profile/ — added alongside /users/ in the auth/permissions plan
// (§2), require_auth only. Not exported from serviceconnection.js yet
// since nothing outside this context needs it directly.
const get_profile = APL_LINK + "api/profile/";

// Matches _serialize_staff_user() in views_admin.py.
export type StaffUser = {
    id: number;
    name: string;
    email: string;
    phone?: string;
    role: "owner" | "dealer_admin" | "branch_manager" | "advisor" | "telecaller";
    branch_id: number | null;
    dealer_id: number;
    can_edit_knowledge: boolean;
    can_edit_agent: boolean;
    can_edit_campaign: boolean;
    can_view_all_branches: boolean;
    must_change_password: boolean;
    [key: string]: unknown;
};

type AuthContextValue = {
    token: string | null;
    user: StaffUser | null;
    loading: boolean;
    role: StaffUser["role"] | null;
    can_edit_knowledge: boolean;
    can_edit_agent: boolean;
    can_edit_campaign: boolean;
    can_view_all_branches: boolean;
    login: (token: string, user: StaffUser | null) => void;
    logout: () => void;
    refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    // Hydrate synchronously from localStorage so there's no
    // unauthenticated flash before the background /me/ refresh lands.
    const [token, setToken] = useState<string | null>(() =>
        hasPersistedToken() ? (getAccessToken() as string | null) : null,
    );
    const [user, setUser] = useState<StaffUser | null>(() => getStaffUser());
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!hasPersistedToken()) {
            setUser(null);
            setToken(null);
            setLoading(false);
            return;
        }

        try {
            // GET /profile/ returns the live StaffUser row fresh — permissions
            // can change server-side (role edit, flag flip, deactivation)
            // without the user re-logging in, so this is what keeps role/flag
            // checks in the UI honest beyond whatever was cached at login time.
            const fresh: StaffUser = await server_get_data(get_profile);
            persistAuthSession((getAccessToken() as string) ?? "", fresh);
            setUser(fresh);
        } catch (error) {
            // A 401 here is already handled globally (serviceconnection.js's
            // response interceptor clears the session and hard-redirects to
            // /login), so there's nothing extra to do on failure except stop
            // showing a loading state.
            console.error("Failed to refresh staff user:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = useCallback((newToken: string, newUser: StaffUser | null) => {
        persistAuthSession(newToken, newUser);
        setToken(newToken);
        setUser(newUser);
    }, []);

    const logout = useCallback(() => {
        clearPersistedAuthSession();
        setToken(null);
        setUser(null);
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({
            token,
            user,
            loading,
            role: user?.role ?? null,
            can_edit_knowledge: !!user?.can_edit_knowledge,
            can_edit_agent: !!user?.can_edit_agent,
            can_edit_campaign: !!user?.can_edit_campaign,
            can_view_all_branches: !!user?.can_view_all_branches,
            login,
            logout,
            refresh,
        }),
        [token, user, loading, login, logout, refresh],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Falls back to a safe "logged out" shape instead of throwing when no
// <AuthProvider> is mounted above the caller. A silent throw here takes
// down the whole page (see UsersPage crash) if a route isn't actually
// nested under wherever AuthProvider ends up in the tree -- better to
// degrade to "not logged in / read-only" than hard-crash the route.
const _FALLBACK_AUTH: AuthContextValue = {
    token: null,
    user: null,
    loading: false,
    role: null,
    can_edit_knowledge: false,
    can_edit_agent: false,
    can_edit_campaign: false,
    can_view_all_branches: false,
    login: () => {
        console.error("AuthContext.login() called with no <AuthProvider> mounted");
    },
    logout: () => {
        console.error("AuthContext.logout() called with no <AuthProvider> mounted");
    },
    refresh: async () => {
        console.error("AuthContext.refresh() called with no <AuthProvider> mounted");
    },
};

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        console.error(
            "useAuth() called outside <AuthProvider> -- check that this route is " +
            "actually nested under _app.tsx in the router. Falling back to a " +
            "logged-out/read-only value instead of crashing the page.",
        );
        return _FALLBACK_AUTH;
    }
    return ctx;
}