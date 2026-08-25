import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell"; // adjust path if AppShell lives elsewhere

import Home from "./routes/index";
import Dashboard from "./routes/_app.dashboard";

import Agents from "./routes/_app.agents.index";
import AgentDetails from "./routes/_app.agents.$agentId";
import AgentTraining from "./routes/_app.agents.training";
import AgentRecordings from "./routes/_app.agents.recordings.index";
import AgentRecordingsReview from "./routes/_app.agents.recordings.review";

import Analytics from "./routes/_app.analytics.index";
import Appointments from "./routes/_app.appointments.index";

import Campaigns from "./routes/_app.campaigns.index";
import CampaignDetails from "./routes/_app.campaigns.$id";
import NewCampaign from "./routes/_app.campaigns.new";

import Customers from "./routes/_app.customers.index";
import CustomerDetails from "./routes/_app.customers.$id";

import Integrations from "./routes/_app.integrations.index";
import Journey from "./routes/_app.journey.index";

import Segments from "./routes/_app.segments.index";
import SegmentDetails from "./routes/_app.segments.$slug";

import Settings from "./routes/_app.settings.index";
import Users from "./routes/_app.users.index";

import Voice from "./routes/_app.voice.index";
import VoiceCall from "./routes/_app.voice.$callId";

import WhatsApp from "./routes/_app.whatsapp.index";

// Layout route: wraps every nested route in the header/sidebar shell
function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/agents" element={<Agents />} />
        <Route path="/agents/:agentId" element={<AgentDetails />} />
        <Route path="/agents/training" element={<AgentTraining />} />
        <Route path="/agents/recordings" element={<AgentRecordings />} />
        <Route path="/agents/recordings/review" element={<AgentRecordingsReview />} />

        <Route path="/analytics" element={<Analytics />} />
        <Route path="/appointments" element={<Appointments />} />

        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/new" element={<NewCampaign />} />
        <Route path="/campaigns/:id" element={<CampaignDetails />} />

        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetails />} />

        <Route path="/integrations" element={<Integrations />} />
        <Route path="/journey" element={<Journey />} />

        <Route path="/segments" element={<Segments />} />
        <Route path="/segments/:slug" element={<SegmentDetails />} />

        <Route path="/settings" element={<Settings />} />
        <Route path="/users" element={<Users />} />

        <Route path="/voice" element={<Voice />} />
        <Route path="/voice/:callId" element={<VoiceCall />} />

        <Route path="/whatsapp" element={<WhatsApp />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
