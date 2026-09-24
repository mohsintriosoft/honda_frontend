import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

import { useNavigate } from "react-router-dom";

import {
  LayoutDashboard,
  Users,
  Layers,
  Megaphone,
  PhoneCall,
  MessageSquare,
  CalendarDays,
  BarChart3,
  Route,
  Plus,
  Sparkles,
  Bot,
  GraduationCap,
  AudioLines,
  ClipboardCheck,
} from "lucide-react";

import { canAccessPath, hasPerm } from "@/lib/permissions";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  // Rights for quick actions (actions need edit rights, not just view).
  const canNewCampaign = hasPerm("campaigns.edit");
  const canAskCustomer = canAccessPath("/customers");
  const canTrainAgent = hasPerm("agents.edit");
  const canRecordings = canAccessPath("/agents/recordings");
  const canReviewTraining = hasPerm("agents.edit");

  const showQuickActions =
    canNewCampaign || canAskCustomer || canTrainAgent || canRecordings || canReviewTraining;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command, route, or search…" />

      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {/* Quick Actions */}
        {showQuickActions && (
          <>
            <CommandGroup heading="Quick actions">
              {canNewCampaign && (
                <CommandItem onSelect={() => go("/campaigns/new")}>
                  <Plus className="mr-2 size-4" />
                  New campaign
                </CommandItem>
              )}

              {canAskCustomer && (
                <CommandItem onSelect={() => go("/customers")}>
                  <Sparkles className="mr-2 size-4 text-[color:var(--ai)]" />
                  Ask AI about a customer
                </CommandItem>
              )}

              {canTrainAgent && (
                <CommandItem onSelect={() => go("/agents/training")}>
                  <GraduationCap className="mr-2 size-4" />
                  Add agent training data
                </CommandItem>
              )}

              {canRecordings && (
                <CommandItem onSelect={() => go("/agents/recordings")}>
                  <AudioLines className="mr-2 size-4" />
                  Train from call recordings
                </CommandItem>
              )}

              {canReviewTraining && (
                <CommandItem onSelect={() => go("/agents/recordings/review")}>
                  <ClipboardCheck className="mr-2 size-4" />
                  Review mined training data
                </CommandItem>
              )}
            </CommandGroup>

            <CommandSeparator />
          </>
        )}

        {/* Navigation */}
        <CommandGroup heading="Navigate">
          {canAccessPath("/dashboard") && (
            <CommandItem onSelect={() => go("/dashboard")}>
              <LayoutDashboard className="mr-2 size-4" />
              Dashboard
            </CommandItem>
          )}

          {canAccessPath("/customers") && (
            <CommandItem onSelect={() => go("/customers")}>
              <Users className="mr-2 size-4" />
              Customer 360
            </CommandItem>
          )}

          {canAccessPath("/segments") && (
            <CommandItem onSelect={() => go("/segments")}>
              <Layers className="mr-2 size-4" />
              Segments
            </CommandItem>
          )}

          {canAccessPath("/campaigns") && (
            <CommandItem onSelect={() => go("/campaigns")}>
              <Megaphone className="mr-2 size-4" />
              Campaigns
            </CommandItem>
          )}

          {canAccessPath("/journey") && (
            <CommandItem onSelect={() => go("/journey")}>
              <Route className="mr-2 size-4" />
              Journey
            </CommandItem>
          )}

          {canAccessPath("/agents") && (
            <CommandItem onSelect={() => go("/agents")}>
              <Bot className="mr-2 size-4" />
              AI Agents
            </CommandItem>
          )}

          {canAccessPath("/voice") && (
            <CommandItem onSelect={() => go("/voice")}>
              <PhoneCall className="mr-2 size-4" />
              AI Voice Calls
            </CommandItem>
          )}

          {canAccessPath("/whatsapp") && (
            <CommandItem onSelect={() => go("/whatsapp")}>
              <MessageSquare className="mr-2 size-4" />
              WhatsApp
            </CommandItem>
          )}

          {canAccessPath("/appointments") && (
            <CommandItem onSelect={() => go("/appointments")}>
              <CalendarDays className="mr-2 size-4" />
              Appointments
            </CommandItem>
          )}

          {canAccessPath("/analytics") && (
            <CommandItem onSelect={() => go("/analytics")}>
              <BarChart3 className="mr-2 size-4" />
              Analytics
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
