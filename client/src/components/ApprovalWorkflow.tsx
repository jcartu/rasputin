import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  History,
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
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  const { data: pendingApprovals = [], refetch } =
    trpc.ssh.getPendingApprovals.useQuery(undefined, {
      refetchInterval: 30000,
    });

  const { data: approvalHistory = [], refetch: refetchHistory } =
    trpc.ssh.getApprovalHistory.useQuery(
      { limit: 50 },
      { enabled: activeTab === "history" }
    );

  const handleApprovalNew = useCallback(() => {
    refetch();
    toast.info("New command approval required", {
      description: "A JARVIS task is waiting for your approval",
    });
  }, [refetch]);

  const handleApprovalResolved = useCallback(() => {
    refetch();
    if (activeTab === "history") {
      refetchHistory();
    }
  }, [refetch, refetchHistory, activeTab]);

  useWebSocket({
    onApprovalNew: handleApprovalNew,
    onApprovalResolved: handleApprovalResolved,
  });

  useEffect(() => {
    onApprovalCountChange?.(pendingApprovals.length);
  }, [pendingApprovals.length, onApprovalCountChange]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-500 border-green-500/30 bg-green-500/10";
      case "rejected":
        return "text-red-500 border-red-500/30 bg-red-500/10";
      case "expired":
        return "text-gray-500 border-gray-500/30 bg-gray-500/10";
      default:
        return "text-yellow-500 border-yellow-500/30 bg-yellow-500/10";
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

  const renderApprovalCard = (
    approval: PendingApproval,
    showActions: boolean
  ) => (
    <Card
      key={approval.id}
      className={cn(
        "transition-colors cursor-pointer hover:bg-muted/50",
        approval.riskLevel === "critical" && "border-red-500/30",
        approval.riskLevel === "high" && "border-orange-500/30"
      )}
      onClick={() => viewDetails(approval)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge
                variant="outline"
                className={getRiskColor(approval.riskLevel)}
              >
                {getRiskIcon(approval.riskLevel)}
                <span className="ml-1 capitalize">
                  {approval.riskLevel} Risk
                </span>
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                <Server className="h-3 w-3 mr-1" />
                {`Host #${approval.hostId}`}
              </Badge>
              {!showActions && (
                <Badge
                  variant="outline"
                  className={getStatusColor(approval.status)}
                >
                  {approval.status === "approved" && (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  )}
                  {approval.status === "rejected" && (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {approval.status === "expired" && (
                    <Clock className="h-3 w-3 mr-1" />
                  )}
                  <span className="capitalize">{approval.status}</span>
                </Badge>
              )}
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
                {showActions
                  ? `Expires in ${getTimeRemaining(approval.expiresAt)}`
                  : new Date(approval.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
          {showActions && (
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-green-500 border-green-500/30 hover:bg-green-500/10"
                onClick={e => {
                  e.stopPropagation();
                  handleApprove(approval);
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
                  handleReject(approval);
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
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={v => setActiveTab(v as "pending" | "history")}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Pending
            {pendingApprovals.length > 0 && (
              <Badge
                variant="outline"
                className="text-yellow-500 border-yellow-500/30 ml-1"
              >
                {pendingApprovals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pendingApprovals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">No pending approvals</p>
              <p className="text-xs mt-1">
                JARVIS will request approval for sensitive operations
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {pendingApprovals.map(approval =>
                  renderApprovalCard(
                    approval as unknown as PendingApproval,
                    true
                  )
                )}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {approvalHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <History className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">No approval history</p>
              <p className="text-xs mt-1">
                Past approvals and rejections will appear here
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {approvalHistory.map(approval =>
                  renderApprovalCard(
                    approval as unknown as PendingApproval,
                    false
                  )
                )}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Command Approval{" "}
              {selectedApproval?.status === "pending" ? "Required" : "Details"}
            </DialogTitle>
            <DialogDescription>
              {selectedApproval?.status === "pending"
                ? "JARVIS is requesting permission to execute a potentially sensitive command"
                : `This command was ${selectedApproval?.status}`}
            </DialogDescription>
          </DialogHeader>
          {selectedApproval && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 flex-wrap">
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
                {selectedApproval.status !== "pending" && (
                  <Badge
                    variant="outline"
                    className={getStatusColor(selectedApproval.status)}
                  >
                    <span className="capitalize">
                      {selectedApproval.status}
                    </span>
                  </Badge>
                )}
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

              {selectedApproval.status === "pending" && (
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
              )}

              {selectedApproval.riskLevel === "critical" &&
                selectedApproval.status === "pending" && (
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
              {selectedApproval?.status === "pending" ? "Cancel" : "Close"}
            </Button>
            {selectedApproval?.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                  onClick={() =>
                    selectedApproval && handleReject(selectedApproval)
                  }
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
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
