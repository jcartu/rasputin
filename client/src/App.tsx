import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/JarvisThemeContext";
import SplashScreen from "./components/SplashScreen";
import Home from "./pages/jarvis/Home";
import Research from "./pages/jarvis/Research";
import Prototype from "./pages/jarvis/Prototype";
import Architecture from "./pages/jarvis/Architecture";
import Agents from "./pages/jarvis/Agents";
import Memory from "./pages/jarvis/Memory";
import Daemon from "./pages/jarvis/Daemon";
import Security from "./pages/jarvis/Security";
import Implementation from "./pages/jarvis/Implementation";
import Ingestion from "./pages/jarvis/Ingestion";
import IntegrationGuide from "./pages/jarvis/IntegrationGuide";
import NotFound from "./pages/jarvis/NotFound";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/research" component={Research} />
      <Route path="/prototype" component={Prototype} />
      <Route path="/integration" component={IntegrationGuide} />
      <Route path="/ingestion" component={Ingestion} />
      <Route path="/architecture" component={Architecture} />
      <Route path="/daemon" component={Daemon} />
      <Route path="/agents" component={Agents} />
      <Route path="/memory" component={Memory} />
      <Route path="/security" component={Security} />
      <Route path="/implementation" component={Implementation} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="cyber-blue">
        <TooltipProvider>
          {showSplash ? (
            <SplashScreen onComplete={() => setShowSplash(false)} />
          ) : (
            <>
              <Toaster />
              <Router />
            </>
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
