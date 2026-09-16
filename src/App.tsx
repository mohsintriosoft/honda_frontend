import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";

import Home from "./routes/index";
import Dashboard from "./routes/_app.dashboard";

import Agents from "./routes/_app.agents.index";
import AgentDetails from "./routes/_app.agents.$agentId";
import AgentTraining from "./routes/_app.agents.training";
import AgentRecordings from "./routes/_app.agents.recordings.index";

import Analytics from "./routes/_app.analytics.index";
import Appointments from "./routes/_app.appointments.index";

import Callbacks from "./routes/_app.callbacks.index";

import Branches from "./routes/_app.branches.index";
import BranchDetails from "./routes/_app.branches.$id";

import Campaigns from "./routes/_app.campaigns.index";
import CampaignDetails from "./routes/_app.campaigns.$id";
import NewCampaign from "./routes/_app.campaigns.new";

import Customers from "./routes/_app.customers.index";
import CustomerDetails from "./routes/_app.customers.$id";

import Fillers from "./routes/_app.fillers.index";
import FillerDetail from "./routes/_app.fillers.$id";

import Imports from "./routes/_app.imports.index";
import ImportDetails from "./routes/_app.imports.$id";

import Integrations from "./routes/_app.integrations.index";
import Intents from "./routes/_app.intents.index";
import IntentDetails from "./routes/_app.intents.$id";

import KnowledgeGlobal from "./routes/_app.knowledge.index";

import Segments from "./routes/_app.segments.index";
import SegmentDetails from "./routes/_app.segments.$id";

import Settings from "./routes/_app.settings.index";
import Users from "./routes/_app.users.index";

import Voice from "./routes/_app.voice.index";
import VoiceCall from "./routes/_app.voice.$callId";

import WhatsApp from "./routes/_app.whatsapp.index";

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
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

        {/* Application Layout */}
        <Route element={<AppLayout />}>
          {/* Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* ================= AGENTS ================= */}

          <Route path="/agents" element={<Agents />} />

          <Route path="/agents/training" element={<AgentTraining />} />

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

          <Route path="/campaigns/new" element={<NewCampaign />} />

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
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}