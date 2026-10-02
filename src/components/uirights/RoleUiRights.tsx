import { useState } from "react";
import { EyeOff, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KIND_LABEL, loadAllUiRules, loadMyUiRules, useUiRights } from "@/lib/uiRights";
import { server_delete_data, server_patch_data, ui_rule_url } from "@/components/ServiceConnection/serviceconnection";

/**
 * "Screen restrictions" block for the Roles & rights tab: every UI rule that
 * applies to the selected role. Reads the same store the "Page rights" picker
 * writes to, so a rule picked on any page shows up here immediately.
 */
export function RoleUiRights({ roleCode, roleName }: { roleCode: string; roleName: string }) {
    const ui = useUiRights();
    const [busyId, setBusyId] = useState<number | null>(null);
    if (!ui.canManage) return null;

    const rules = ui.allRules.filter((r) => r.roles.includes(roleCode));
    const refresh = () => Promise.all([loadAllUiRules(), loadMyUiRules()]);

    const removeFromRole = async (id: number) => {
        const r = ui.allRules.find((x) => x.id === id);
        if (!r) return;
        setBusyId(id);
        try {
            const next = r.roles.filter((c) => c !== roleCode);
            if (next.length) await server_patch_data(ui_rule_url(id), { roles: next });
            else if (window.confirm(`“${r.display_label}” only applies to ${roleName}. Delete the rule?`))
                await server_delete_data(ui_rule_url(id));
            await refresh();
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="rounded-lg border">
            <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-wide">Screen restrictions (UI rights)</div>
                    <div className="text-[11px] text-muted-foreground">
                        {rules.length} element{rules.length === 1 ? "" : "s"} hidden / disabled for {roleName}. Add more with the
                        “Page rights” button on any page.
                    </div>
                </div>
            </div>
            <div className="divide-y">
                {rules.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">Nothing restricted for this role.</p>}
                {rules.map((r) => (
                    <div key={r.id} className={`flex items-center justify-between gap-3 px-3 py-2.5 ${r.is_active ? "" : "opacity-50"}`}>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-sm">
                                <EyeOff className="size-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate">
                                    {r.action === "hide" ? "Hide" : "Disable"} {KIND_LABEL[r.kind].toLowerCase()} “{r.display_label}”
                                </span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-1">
                                <Badge variant="outline" className="px-1.5 py-0 font-mono text-[10px]">
                                    {r.path === "*" ? "all pages" : r.path}
                                </Badge>
                                {!r.is_active && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">off</Badge>}
                            </div>
                        </div>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 shrink-0 text-destructive"
                            disabled={busyId === r.id}
                            title={`Remove for ${roleName}`}
                            onClick={() => removeFromRole(r.id)}
                        >
                            {busyId === r.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}