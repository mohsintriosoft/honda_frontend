import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Layers, Megaphone, PhoneCall,
  MessageSquare, CalendarDays, BarChart3, Route, Plus, Sparkles, Bot, GraduationCap, AudioLines, ClipboardCheck,
} from "lucide-react";

export function CommandPalette({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command, route, or search…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => go("/campaigns/new")}>
            <Plus className="mr-2 size-4" /> New campaign
          </CommandItem>
          <CommandItem onSelect={() => go("/customers")}>
            <Sparkles className="mr-2 size-4 text-[color:var(--ai)]" /> Ask AI about a customer
          </CommandItem>
          <CommandItem onSelect={() => go("/agents/training")}>
            <GraduationCap className="mr-2 size-4" /> Add agent training data
          </CommandItem>
          <CommandItem onSelect={() => go("/agents/recordings")}>
            <AudioLines className="mr-2 size-4" /> Train from call recordings
          </CommandItem>
          <CommandItem onSelect={() => go("/agents/recordings/review")}>
            <ClipboardCheck className="mr-2 size-4" /> Review mined training data
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/dashboard")}><LayoutDashboard className="mr-2 size-4" />Dashboard</CommandItem>
          <CommandItem onSelect={() => go("/customers")}><Users className="mr-2 size-4" />Customer 360</CommandItem>
          <CommandItem onSelect={() => go("/segments")}><Layers className="mr-2 size-4" />Segments</CommandItem>
          <CommandItem onSelect={() => go("/campaigns")}><Megaphone className="mr-2 size-4" />Campaigns</CommandItem>
          <CommandItem onSelect={() => go("/journey")}><Route className="mr-2 size-4" />Journey</CommandItem>
          <CommandItem onSelect={() => go("/agents")}><Bot className="mr-2 size-4" />AI Agents</CommandItem>
          <CommandItem onSelect={() => go("/voice")}><PhoneCall className="mr-2 size-4" />AI Voice Calls</CommandItem>
          <CommandItem onSelect={() => go("/whatsapp")}><MessageSquare className="mr-2 size-4" />WhatsApp</CommandItem>
          <CommandItem onSelect={() => go("/appointments")}><CalendarDays className="mr-2 size-4" />Appointments</CommandItem>
          <CommandItem onSelect={() => go("/analytics")}><BarChart3 className="mr-2 size-4" />Analytics</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
