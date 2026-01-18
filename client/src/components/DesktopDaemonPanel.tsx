import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Monitor,
  Wifi,
  WifiOff,
  Copy,
  CheckCircle,
  Loader2,
  Unplug,
} from "lucide-react";

export function DesktopDaemonPanel() {
  const [pairingDialogOpen, setPairingDialogOpen] = useState(false);
  const [daemonUrl, setDaemonUrl] = useState("http://localhost:21337");
  const [pairingCode, setPairingCode] = useState("");

  const statusQuery = trpc.desktop.getStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const toolsQuery = trpc.desktop.listTools.useQuery(undefined, {
    enabled: statusQuery.data?.connected === true,
  });

  const initiatePairingMutation = trpc.desktop.initiatePairing.useMutation({
    onSuccess: data => {
      setPairingCode(data.code);
      toast.success(
        "Pairing initiated! Enter the code in your desktop daemon."
      );
    },
    onError: err => {
      toast.error(`Failed to initiate pairing: ${err.message}`);
    },
  });

  const completePairingMutation = trpc.desktop.completePairing.useMutation({
    onSuccess: data => {
      if (data.success) {
        toast.success("Desktop daemon paired successfully!");
        setPairingDialogOpen(false);
        setPairingCode("");
        statusQuery.refetch();
      } else {
        toast.error(data.error || "Pairing failed");
      }
    },
    onError: err => {
      toast.error(`Pairing failed: ${err.message}`);
    },
  });

  const disconnectMutation = trpc.desktop.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Desktop daemon disconnected");
      statusQuery.refetch();
    },
  });

  const copyPairingCode = () => {
    navigator.clipboard.writeText(pairingCode);
    toast.success("Pairing code copied!");
  };

  const handleCompletePairing = () => {
    if (!pairingCode) {
      toast.error("Please initiate pairing first");
      return;
    }
    completePairingMutation.mutate({ code: pairingCode, daemonUrl });
  };

  const status = statusQuery.data;
  const isConnected = status?.connected === true;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Desktop Daemon</h2>
        {isConnected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
          >
            <Unplug className="w-4 h-4 mr-2" />
            Disconnect
          </Button>
        ) : (
          <Dialog open={pairingDialogOpen} onOpenChange={setPairingDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-violet-600 hover:bg-violet-700">
                <Wifi className="w-4 h-4 mr-2" />
                Pair Desktop
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background border-border">
              <DialogHeader>
                <DialogTitle>Pair Desktop Daemon</DialogTitle>
                <DialogDescription>
                  Connect your desktop to enable clipboard, screenshots,
                  notifications, and more.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Daemon URL</Label>
                  <Input
                    value={daemonUrl}
                    onChange={e => setDaemonUrl(e.target.value)}
                    placeholder="http://localhost:21337"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    URL where your desktop daemon is running
                  </p>
                </div>

                {pairingCode ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-card rounded-lg text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        Enter this code in your desktop daemon:
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <code className="text-3xl font-mono font-bold tracking-widest text-violet-400">
                          {pairingCode}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={copyPairingCode}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleCompletePairing}
                      disabled={completePairingMutation.isPending}
                    >
                      {completePairingMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Complete Pairing
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => initiatePairingMutation.mutate()}
                    disabled={initiatePairingMutation.isPending}
                  >
                    {initiatePairingMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Wifi className="w-4 h-4 mr-2" />
                    )}
                    Generate Pairing Code
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="bg-card/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-violet-400" />
              <CardTitle className="text-lg">Connection Status</CardTitle>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 mr-1" /> Connected
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 mr-1" /> Not Connected
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {statusQuery.isLoading ? (
            <div className="animate-pulse text-muted-foreground">
              Checking connection...
            </div>
          ) : isConnected ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Your desktop daemon is connected and ready to receive commands.
              </div>
              {toolsQuery.data && toolsQuery.data.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Available Tools:</p>
                  <div className="flex flex-wrap gap-2">
                    {toolsQuery.data.map(tool => (
                      <Badge
                        key={tool}
                        variant="outline"
                        className="font-mono text-xs"
                      >
                        {tool.replace("desktop_", "")}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              <p>No desktop daemon connected.</p>
              <p className="mt-2">
                Download and run the daemon on your computer, then click "Pair
                Desktop" to connect.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {isConnected && (
        <Card className="bg-card/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">What You Can Do</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Read and write clipboard
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Take screenshots
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Show system notifications
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Open URLs, files, and applications
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Get system information
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                File dialogs and window info
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
