import Layout from "@/components/JarvisLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, AlertTriangle } from "lucide-react";

export default function Daemon() {
  return (
    <Layout>
      <div className="space-y-10">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight font-mono">4. Desktop Daemon</h1>
            <Badge variant="destructive" className="font-mono">PRIVILEGED ACCESS</Badge>
          </div>
          <p className="text-lg text-muted-foreground">
            The "MANUS Killer" component providing full OS-level control via a Rust-based gRPC server.
          </p>
        </div>

        {/* Hero Image */}
        <div className="relative aspect-[21/9] w-full overflow-hidden rounded-lg border border-border bg-black/50">
          <img 
            src="/images/desktop-daemon.jpg" 
            alt="Desktop Daemon Visualization" 
            className="object-cover w-full h-full opacity-80"
          />
        </div>

        {/* Core Capabilities */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight font-mono border-b border-border pb-2">
            4.1 Core Capabilities
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="bg-card/50 border-primary/20">
              <CardHeader>
                <CardTitle className="font-mono text-primary">Perception</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• <strong>Screen Capture</strong>: Low-latency (60fps) DXGI/PipeWire capture</p>
                <p>• <strong>A11y Tree</strong>: Direct access to UI automation trees</p>
                <p>• <strong>OCR</strong>: Real-time text extraction via local GPU</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 border-primary/20">
              <CardHeader>
                <CardTitle className="font-mono text-primary">Action</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• <strong>Input Injection</strong>: Hardware-level mouse/keyboard simulation</p>
                <p>• <strong>Window Mgmt</strong>: Move, resize, focus, minimize/maximize</p>
                <p>• <strong>Process Ctrl</strong>: Spawn, kill, monitor system processes</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-primary/20">
              <CardHeader>
                <CardTitle className="font-mono text-primary">System</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• <strong>File Ops</strong>: High-speed I/O bypassing user shell</p>
                <p>• <strong>Network</strong>: Packet capture and traffic analysis</p>
                <p>• <strong>Clipboard</strong>: Read/write access to system clipboard</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Implementation Details */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight font-mono border-b border-border pb-2">
            4.2 Implementation Specification
          </h2>
          
          <div className="rounded-lg border border-border bg-black p-4 font-mono text-sm overflow-x-auto">
            <div className="flex items-center gap-2 text-muted-foreground mb-4 border-b border-border/20 pb-2">
              <Terminal className="h-4 w-4" />
              <span>daemon/proto/desktop.proto</span>
            </div>
            <pre className="text-green-400">
{`service DesktopControl {
  // Screen Capture
  rpc StreamScreen(StreamConfig) returns (stream Frame);
  rpc GetScreenshot(ScreenshotConfig) returns (Image);
  
  // Input Injection
  rpc MoveMouse(MouseCoords) returns (Empty);
  rpc Click(ClickType) returns (Empty);
  rpc TypeText(TextPayload) returns (Empty);
  rpc PressKey(KeyCombo) returns (Empty);
  
  // Window Management
  rpc ListWindows(Empty) returns (WindowList);
  rpc FocusWindow(WindowID) returns (Empty);
  rpc GetWindowBounds(WindowID) returns (Rect);
  
  // Process Control
  rpc ExecuteCommand(Command) returns (ProcessResult);
  rpc KillProcess(ProcessID) returns (Empty);
}`}
            </pre>
          </div>
        </section>

        {/* Safety Warning */}
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/50 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Safety Protocol Required</AlertTitle>
          <AlertDescription>
            The Desktop Daemon has root-level capabilities. It must run inside a strict capability-based sandbox 
            with a "Human-in-the-Loop" killswitch enabled by default during the alpha phase.
          </AlertDescription>
        </Alert>
      </div>
    </Layout>
  );
}
