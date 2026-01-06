import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Server,
  Shield,
  Loader2,
  Bell,
  // Eye,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PendingApproval {
  id: number;
  taskId: number | null;
  hostId: number;
  command: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "expired" | "modified";
  createdAt: Date;
  expiresAt: Date | null;
  workingDirectory: string | null;
  reason: string | null;
}

interface ApprovalWorkflowProps {
  onApprovalCountChange?: (count: number) => void;
}

export function ApprovalWorkflow({
  onApprovalCountChange,
}: ApprovalWorkflowProps) {
  const [selectedApproval, setSelectedApproval] =
    useState<PendingApproval | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Query pending approvals
  const { data: pendingApprovals = [], refetch } =
    trpc.ssh.getPendingApprovals.useQuery(undefined, {
      refetchInterval: 5000, // Poll every 5 seconds for new approvals
    });

  // Notify parent of count changes
  useEffect(() => {
    onApprovalCountChange?.(pendingApprovals.length);
  }, [pendingApprovals.length, onApprovalCountChange]);

  // Mutations
  const approveCommand = trpc.ssh.approveCommand.useMutation({
    onSuccess: () => {
      toast.success("Command approved and executing");
      setIsDetailOpen(false);
      setSelectedApproval(null);
      refetch();
    },
    onError: error => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  const rejectCommand = trpc.ssh.rejectCommand.useMutation({
    onSuccess: () => {
      toast.info("Command rejected");
      setIsDetailOpen(false);
      setSelectedApproval(null);
      refetch();
    },
    onError: error => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
        return "text-red-500 border-red-500/30 bg-red-500/10";
      case "high":
        return "text-orange-500 border-orange-500/30 bg-orange-500/10";
      case "medium":
        return "text-yellow-500 border-yellow-500/30 bg-yellow-500/10";
      default:
        return "text-blue-500 border-blue-500/30 bg-blue-500/10";
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case "critical":
      case "high":
        return <AlertTriangle className="h-4 w-4" />;
      case "medium":
        return <Shield className="h-4 w-4" />;
      default:
        return <Terminal className="h-4 w-4" />;
    }
  };

  const getTimeRemaining = (expiresAt: Date | null) => {
    if (!expiresAt) return "No expiry";
    const now = new Date();
    const diff = new Date(expiresAt).getTime() - now.getTime();
    if (diff <= 0) return "Expired";
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const handleApprove = (approval: PendingApproval) => {
    approveCommand.mutate({ approvalId: approval.id });
  };

  const handleReject = (approval: PendingApproval) => {
    rejectCommand.mutate({ approvalId: approval.id });
  };

  const viewDetails = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    setIsDetailOpen(true);
  };

  if (pendingApprovals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">No pending approvals</p>
        <p className="text-xs mt-1">
          JARVIS will request approval for sensitive operations
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-yellow-500" />
          <h3 className="font-semibold">Pending Approvals</h3>
          <Badge
            variant="outline"
            className="text-yellow-500 border-yellow-500/30"
          >
            {pendingApprovals.length}
          </Badge>
        </div>
      </div>

      {/* Approval List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {pendingApprovals.map(approval => (
            <Card
              key={approval.id}
              className={cn(
                "transition-colors cursor-pointer hover:bg-muted/50",
                approval.riskLevel === "critical" && "border-red-500/30",
                approval.riskLevel === "high" && "border-orange-500/30"
              )}
              onClick={() =>
                viewDetails(approval as unknown as PendingApproval)
              }
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={getRiskColor(approval.riskLevel)}
                      >
                        {getRiskIcon(approval.riskLevel)}
                        <span className="ml-1 capitalize">
                          {approval.riskLevel} Risk
                        </span>
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        <Server className="h-3 w-3 mr-1" />
                        {`Host #${approval.hostId}`}
                      </Badge>
                    </div>
                    <p className="font-mono text-sm truncate text-cyan-400">
                      $ {approval.command}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {approval.reason}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        Expires in {getTimeRemaining(approval.expiresAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-500 border-green-500/30 hover:bg-green-500/10"
                      onClick={e => {
                        e.stopPropagation();
                        handleApprove(approval as unknown as PendingApproval);
                      }}
                      disabled={approveCommand.isPending}
                    >
                      {approveCommand.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                      onClick={e => {
                        e.stopPropagation();
                        handleReject(approval as unknown as PendingApproval);
                      }}
                      disabled={rejectCommand.isPending}
                    >
                      {rejectCommand.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Command Approval Required
            </DialogTitle>
            <DialogDescription>
              JARVIS is requesting permission to execute a potentially sensitive
              command
            </DialogDescription>
          </DialogHeader>
          {selectedApproval && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={getRiskColor(selectedApproval.riskLevel)}
                >
                  {getRiskIcon(selectedApproval.riskLevel)}
                  <span className="ml-1 capitalize">
                    {selectedApproval.riskLevel} Risk
                  </span>
                </Badge>
                <Badge variant="outline">
                  <Server className="h-3 w-3 mr-1" />
                  {`Host #${selectedApproval.hostId}`}
                </Badge>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Command</label>
                <div className="p-3 rounded-md bg-muted font-mono text-sm">
                  <span className="text-cyan-400">
                    $ {selectedApproval.command}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Reason</label>
                <p className="text-sm text-muted-foreground">
                  {selectedApproval.reason}
                </p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Requested</span>
                <span>
                  {new Date(selectedApproval.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Expires</span>
                <span
                  className={cn(
                    getTimeRemaining(selectedApproval.expiresAt) ===
                      "Expired" && "text-red-500"
                  )}
                >
                  {selectedApproval.expiresAt
                    ? new Date(selectedApproval.expiresAt).toLocaleString()
                    : "No expiry"}
                </span>
              </div>

              {selectedApproval.riskLevel === "critical" && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-500">
                        Critical Risk Warning
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This command could cause significant system changes.
                        Please review carefully before approving.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              className="text-red-500 border-red-500/30 hover:bg-red-500/10"
              onClick={() => selectedApproval && handleReject(selectedApproval)}
              disabled={rejectCommand.isPending}
            >
              {rejectCommand.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() =>
                selectedApproval && handleApprove(selectedApproval)
              }
              disabled={approveCommand.isPending}
            >
              {approveCommand.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Approve & Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Approval notification badge for the header
 */
export function ApprovalBadge() {
  const { data: pendingApprovals = [] } = trpc.ssh.getPendingApprovals.useQuery(
    undefined,
    {
      refetchInterval: 10000,
    }
  );

  if (pendingApprovals.length === 0) return null;

  return (
    <Badge
      variant="outline"
      className="text-yellow-500 border-yellow-500/30 bg-yellow-500/10 animate-pulse"
    >
      <Bell className="h-3 w-3 mr-1" />
      {pendingApprovals.length} Pending
    </Badge>
  );
}
