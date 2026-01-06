import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

// Store the deferred prompt globally so it persists across component remounts
let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(deferredPrompt);
  const [isInstallable, setIsInstallable] = useState(!!deferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showManualInstructions, setShowManualInstructions] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const checkInstalled = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");

      if (isStandalone) {
        console.log("[PWA] App is running in standalone mode");
        setIsInstalled(true);
        return true;
      }
      return false;
    };

    if (checkInstalled()) return;

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      console.log("[PWA] beforeinstallprompt event fired");
      // Store the event for later use
      deferredPrompt = e;
      setInstallPrompt(e);
      setIsInstallable(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log("[PWA] App was installed");
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
      deferredPrompt = null;
    };

    // Listen for display mode changes
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
      }
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt as EventListener
    );
    window.addEventListener("appinstalled", handleAppInstalled);
    mediaQuery.addEventListener("change", handleDisplayModeChange);

    // If we already have a deferred prompt from a previous mount, use it
    if (deferredPrompt) {
      setInstallPrompt(deferredPrompt);
      setIsInstallable(true);
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt as EventListener
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      mediaQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  const install = useCallback(async () => {
    const promptToUse = installPrompt || deferredPrompt;

    if (!promptToUse) {
      console.log(
        "[PWA] No install prompt available, showing manual instructions"
      );
      setShowManualInstructions(true);
      return false;
    }

    try {
      console.log("[PWA] Triggering install prompt");
      await promptToUse.prompt();
      const { outcome } = await promptToUse.userChoice;
      console.log("[PWA] User choice:", outcome);

      if (outcome === "accepted") {
        setIsInstalled(true);
        setIsInstallable(false);
      }

      // Clear the prompt after use
      setInstallPrompt(null);
      deferredPrompt = null;
      return outcome === "accepted";
    } catch (error) {
      console.error("[PWA] Install error:", error);
      setShowManualInstructions(true);
      return false;
    }
  }, [installPrompt]);

  const dismissManualInstructions = useCallback(() => {
    setShowManualInstructions(false);
  }, []);

  // Detect browser and platform for manual instructions
  const getManualInstructions = useCallback(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isChrome = /chrome/.test(ua) && !/edge|edg/.test(ua);
    const isSafari = /safari/.test(ua) && !/chrome/.test(ua);
    const isFirefox = /firefox/.test(ua);
    const isSamsung = /samsungbrowser/.test(ua);

    if (isIOS && isSafari) {
      return {
        browser: "Safari",
        steps: [
          "Tap the Share button (square with arrow)",
          'Scroll down and tap "Add to Home Screen"',
          'Tap "Add" to confirm',
        ],
      };
    } else if (isIOS) {
      return {
        browser: "iOS Browser",
        steps: [
          "Open this page in Safari",
          "Tap the Share button",
          'Tap "Add to Home Screen"',
        ],
      };
    } else if (isAndroid && isChrome) {
      return {
        browser: "Chrome",
        steps: [
          "Tap the three-dot menu (⋮) in the top right",
          'Tap "Add to Home screen" or "Install app"',
          'Tap "Add" or "Install" to confirm',
        ],
      };
    } else if (isAndroid && isSamsung) {
      return {
        browser: "Samsung Internet",
        steps: [
          "Tap the menu icon (≡) at the bottom",
          'Tap "Add page to" → "Home screen"',
          'Tap "Add" to confirm',
        ],
      };
    } else if (isAndroid && isFirefox) {
      return {
        browser: "Firefox",
        steps: [
          "Tap the three-dot menu (⋮)",
          'Tap "Install"',
          'Tap "Add" to confirm',
        ],
      };
    } else if (isChrome) {
      return {
        browser: "Chrome",
        steps: [
          "Click the install icon (⊕) in the address bar",
          'Or click the three-dot menu → "Install RASPUTIN"',
          'Click "Install" to confirm',
        ],
      };
    } else {
      return {
        browser: "your browser",
        steps: [
          'Look for an "Install" or "Add to Home Screen" option',
          "Check the browser menu or address bar",
          "Follow the prompts to install",
        ],
      };
    }
  }, []);

  return {
    isInstallable: isInstallable || !isInstalled, // Always show install option if not installed
    isInstalled,
    install,
    showManualInstructions,
    dismissManualInstructions,
    getManualInstructions,
  };
}
