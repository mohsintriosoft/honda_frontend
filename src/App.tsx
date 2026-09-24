import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
  useLocation,
} from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import {
  isAuthenticated,
  clearAuthSession,
} from "@/components/ServiceConnection/serviceconnection";
import { AuthProvider } from "@/context/AuthContext";
import { canAccessPath, getPermissions, landingPath } from "@/lib/permissions";

import Home from "./routes/index";
import Agents from "./routes/Agents";
import AgentDetails from "./routes/AgentDetails";
import AgentRecordings from "./routes/AgentRecordings";
import Appointments from "./routes/Appointments";
import Branches from "./routes/Branches";
import BranchDetails from "./routes/BranchDetails";
import Campaigns from "./routes/Campaigns";
import CampaignDetails from "./routes/CampaignDetails";
import Customers from "./routes/Customers";
import CustomerDetails from "./routes/CustomerDetails";
import Fillers from "./routes/Fillers";
import FillerDetail from "./routes/FillerDetail";
import Imports from "./routes/Imports";
import ImportDetails from "./routes/ImportDetails";
import Intents from "./routes/Intents";
import IntentDetails from "./routes/IntentDetails";
import KnowledgeGlobal from "./routes/KnowledgeGlobal";
import Segments from "./routes/Segments";
import SegmentDetails from "./routes/SegmentDetails";
import Voice from "./routes/Voice";
import VoiceCall from "./routes/VoiceCall";
import Health from "./routes/Health";
import Callbacks from "./routes/Callbacks";
import Login from "./routes/login";
import Dashboard from "./routes/Dashboard";

import Users from "./routes/_app.users.index";
import OmHondaChunks from "./routes/omhondachunks";
import WhatsApp from "./routes/_app.whatsapp.index";
import Settings from "./routes/_app.settings.index";
import Integrations from "./routes/_app.integrations.index";
import Analytics from "./routes/_app.analytics.index";

function AppLayout({ forbidden = false }: { forbidden?: boolean }) {
  return (
    <AuthProvider>
      <AppShell>{forbidden ? <Forbidden /> : <Outlet />}</AppShell>
    </AuthProvider>
  );
}

// Gates every route under AppLayout behind a session AND the role's rights.
// Everything here is a synchronous localStorage read -- no flash.
function RequireAuth() {
  const { pathname } = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // Session saved before rights existed -> force a fresh login so the
  // user object carries `permissions`.
  if (!getPermissions()) {
    clearAuthSession();
    return <Navigate to="/login" replace />;
  }

  if (!canAccessPath(pathname)) {
    // Login lands on /dashboard -- send roles without it to their own home.
    const home = landingPath();
    if (pathname === "/dashboard" && home !== "/dashboard") {
      return <Navigate to={home} replace />;
    }
    return <AppLayout forbidden />;
  }

  return <AppLayout />;
}

function Forbidden() {
  const home = landingPath();
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <h1 className="text-5xl font-bold">403</h1>
        <p className="mt-2 text-muted-foreground">
          Your role doesn't have access to this page. Ask your admin to add the right to your role.
        </p>
        <Link
          to={home}
          className="inline-flex mt-5 px-4 py-2 rounded-md bg-primary text-primary-foreground"
        >
          Go to home
        </Link>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found</p>

        <a
          href="/dashboard"
          className="inline-flex mt-5 px-4 py-2 rounded-md bg-primary text-primary-foreground"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home */}
        <Route path="/" element={<Home />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />

        {/* Standalone browser test-call page — deliberately OUTSIDE
            AppLayout (no sidebar/topbar), same as a real incoming-call
            screen would be. */}
        <Route path="/omhondachunks" element={<OmHondaChunks />} />

        {/* Application Layout */}
        <Route element={<RequireAuth />}>
          {/* Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* ================= AGENTS ================= */}
          <Route path="/agents" element={<Agents />} />
          <Route path="/agents/recordings" element={<AgentRecordings />} />
          <Route path="/agents/:agentId" element={<AgentDetails />} />

          {/* ================= ANALYTICS ================= */}
          <Route path="/analytics" element={<Analytics />} />

          {/* ================= APPOINTMENTS ================= */}
          <Route path="/appointments" element={<Appointments />} />

          {/* ================= CALLBACKS ================= */}
          <Route path="/callbacks" element={<Callbacks />} />

          {/* ================= BRANCHES ================= */}
          <Route path="/branches" element={<Branches />} />
          <Route path="/branches/:id" element={<BranchDetails />} />

          {/* ================= CAMPAIGNS ================= */}
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/:id" element={<CampaignDetails />} />

          {/* ================= CUSTOMERS ================= */}
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetails />} />

          {/* ================= FILLERS ================= */}
          <Route path="/fillers" element={<Fillers />} />
          <Route path="/fillers/:code" element={<FillerDetail />} />

          {/* ================= DATA IMPORT ================= */}
          <Route path="/imports" element={<Imports />} />
          <Route path="/imports/:id" element={<ImportDetails />} />

          {/* ================= INTEGRATIONS ================= */}
          <Route path="/integrations" element={<Integrations />} />

          {/* ================= INTENTS ================= */}
          <Route path="/intents" element={<Intents />} />
          <Route path="/intents/:code" element={<IntentDetails />} />

          {/* ================= KNOWLEDGE ================= */}
          <Route path="/knowledge" element={<KnowledgeGlobal />} />

          {/* ================= SEGMENTS ================= */}
          <Route path="/segments" element={<Segments />} />
          <Route path="/segments/:id" element={<SegmentDetails />} />

          {/* ================= SETTINGS ================= */}
          <Route path="/settings" element={<Settings />} />

          {/* ================= USERS ================= */}
          <Route path="/users" element={<Users />} />

          {/* ================= VOICE ================= */}
          <Route path="/voice" element={<Voice />} />
          <Route path="/voice/:callId" element={<VoiceCall />} />

          {/* ================= WHATSAPP ================= */}
          <Route path="/whatsapp" element={<WhatsApp />} />

          {/* ================= HEALTH ================= */}
          <Route path="/health" element={<Health />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
