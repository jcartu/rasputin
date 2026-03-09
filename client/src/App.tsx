import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/JarvisThemeContext";
import { VoiceAnnouncementProvider } from "./contexts/VoiceAnnouncementContext";
import SplashScreen from "./components/SplashScreen";

// Main functional pages (connected to real backends)
import Chat from "./pages/Chat";
import Agent from "./pages/Agent";
import Login from "./pages/Login";
import Infrastructure from "./pages/Infrastructure";
import MultiAgent from "./pages/MultiAgent";
import Hosts from "./pages/Hosts";
import Events from "./pages/Events";
import Codebase from "./pages/Codebase";
import MemoryPage from "./pages/Memory";
import Manus from "./pages/Manus";
import Workspace from "./pages/Workspace";
import PromptLibrary from "./pages/PromptLibrary";

// Documentation/demo pages (moved to /docs/*)
import DocsHome from "./pages/jarvis/Home";
import DocsResearch from "./pages/jarvis/Research";
import DocsPrototype from "./pages/jarvis/Prototype";
import DocsArchitecture from "./pages/jarvis/Architecture";
import DocsAgents from "./pages/jarvis/Agents";
import DocsMemory from "./pages/jarvis/Memory";
import DocsDaemon from "./pages/jarvis/Daemon";
import DocsSecurity from "./pages/jarvis/Security";
import DocsImplementation from "./pages/jarvis/Implementation";
import DocsIngestion from "./pages/jarvis/Ingestion";
import DocsIntegrationGuide from "./pages/jarvis/IntegrationGuide";
import NotFound from "./pages/jarvis/NotFound";

function Router() {
  return (
    <Switch>
      {/* Main functional routes - connected to real backends */}
      <Route path="/" component={Chat} />
      <Route path="/chat" component={Chat} />
      <Route path="/chat/:id" component={Chat} />
      <Route path="/agent" component={Agent} />
      <Route path="/login" component={Login} />
      <Route path="/infrastructure" component={Infrastructure} />
      <Route path="/multi-agent" component={MultiAgent} />
      <Route path="/hosts" component={Hosts} />
      <Route path="/events" component={Events} />
      <Route path="/codebase" component={Codebase} />
      <Route path="/memory" component={MemoryPage} />
      <Route path="/manus" component={Manus} />
      <Route path="/workspace" component={Workspace} />
      <Route path="/prompts" component={PromptLibrary} />

      {/* Documentation/demo routes */}
      <Route path="/docs" component={DocsHome} />
      <Route path="/docs/research" component={DocsResearch} />
      <Route path="/docs/prototype" component={DocsPrototype} />
      <Route path="/docs/architecture" component={DocsArchitecture} />
      <Route path="/docs/agents" component={DocsAgents} />
      <Route path="/docs/memory" component={DocsMemory} />
      <Route path="/docs/daemon" component={DocsDaemon} />
      <Route path="/docs/security" component={DocsSecurity} />
      <Route path="/docs/implementation" component={DocsImplementation} />
      <Route path="/docs/ingestion" component={DocsIngestion} />
      <Route path="/docs/integration" component={DocsIntegrationGuide} />

      {/* Legacy routes - redirect to new structure */}
      <Route path="/research" component={DocsResearch} />
      <Route path="/research/:id" component={DocsResearch} />
      <Route path="/prototype" component={DocsPrototype} />
      <Route path="/architecture" component={DocsArchitecture} />
      <Route path="/agents" component={DocsAgents} />
      <Route path="/daemon" component={DocsDaemon} />
      <Route path="/security" component={DocsSecurity} />
      <Route path="/implementation" component={DocsImplementation} />
      <Route path="/ingestion" component={DocsIngestion} />
      <Route path="/integration" component={DocsIntegrationGuide} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(false);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="cyber-blue">
        <TooltipProvider>
          {showSplash ? (
            <SplashScreen onComplete={() => setShowSplash(false)} />
          ) : (
            <VoiceAnnouncementProvider>
              <Toaster />
              <Router />
            </VoiceAnnouncementProvider>
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
