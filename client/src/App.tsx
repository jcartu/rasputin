import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import SplashScreen from "./components/SplashScreen";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Agent from "./pages/Agent";
import Infrastructure from "./pages/Infrastructure";
import MultiAgent from "./pages/MultiAgent";
import Codebase from "./pages/Codebase";
import Events from "./pages/Events";
import Hosts from "./pages/Hosts";
import { useVoiceAnnouncement } from "./hooks/useVoiceAnnouncement";

function VoiceAnnouncementListener() {
  useVoiceAnnouncement();
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Chat} />
      <Route path="/login" component={Login} />
      <Route path="/chat" component={Chat} />
      <Route path="/chat/:id" component={Chat} />
      <Route path="/agent" component={Agent} />
      <Route path="/infrastructure" component={Infrastructure} />
      <Route path="/multi-agent" component={MultiAgent} />
      <Route path="/codebase" component={Codebase} />
      <Route path="/events" component={Events} />
      <Route path="/hosts" component={Hosts} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    const hasSeenSplash = sessionStorage.getItem("rasputin-splash-seen");
    return !hasSeenSplash;
  });

  useEffect(() => {
    if (!showSplash) {
      sessionStorage.setItem("rasputin-splash-seen", "true");
    }
  }, [showSplash]);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        {showSplash && (
          <SplashScreen
            onComplete={() => setShowSplash(false)}
            duration={3500}
          />
        )}
        <TooltipProvider>
          <VoiceAnnouncementListener />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "oklch(0.16 0.02 260)",
                border: "1px solid oklch(0.28 0.02 260)",
                color: "oklch(0.95 0.01 260)",
              },
            }}
          />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
