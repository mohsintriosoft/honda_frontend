import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { UserPlus } from "lucide-react";

const users = [
  {
    name: "Rajesh Saini",
    email: "rajesh@omhonda.in",
    role: "Service Manager",
    branch: "MP Nagar",
    status: "active",
  },
  {
    name: "Priya Mehta",
    email: "priya@omhonda.in",
    role: "Dealer Principal",
    branch: "All",
    status: "active",
  },
  {
    name: "Anil Khanna",
    email: "anil@omhonda.in",
    role: "Service Advisor",
    branch: "Kolar Road",
    status: "active",
  },
  {
    name: "Ravi Deshmukh",
    email: "ravi@omhonda.in",
    role: "Service Advisor",
    branch: "Ayodhya Bypass",
    status: "active",
  },
  {
    name: "Sunita Rao",
    email: "sunita@omhonda.in",
    role: "Call Center",
    branch: "MP Nagar",
    status: "active",
  },
  {
    name: "Mohit Bansal",
    email: "mohit@omhonda.in",
    role: "Marketing",
    branch: "All",
    status: "invited",
  },
];

export default function UsersPage() {
  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Manage team access with role-based permissions per branch."
        actions={
          <Button size="sm">
            <UserPlus className="size-4" />
            Invite user
          </Button>
        }
      />

      <div className="p-4 md:p-6 lg:p-8">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>

              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.email}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">{initials(u.name)}</AvatarFallback>
                        </Avatar>

                        <div>
                          <div className="font-medium text-sm">{u.name}</div>

                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-sm">{u.role}</TableCell>

                    <TableCell className="text-sm">{u.branch}</TableCell>

                    <TableCell>
                      <span
                        className={`text-[10px] rounded-full px-2 py-0.5 ${
                          u.status === "active"
                            ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                            : "bg-[color:var(--warning)]/15 text-[color:var(--warning-foreground)]"
                        }`}
                      >
                        {u.status}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost">
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
