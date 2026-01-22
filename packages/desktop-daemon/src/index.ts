import { startServer } from "./server";
import { startTrayServer } from "./tray";

const args = process.argv.slice(2);
const headless = args.includes("--headless") || args.includes("-h");

console.info("Starting Rasputin Desktop Daemon...");

const server = startServer();

if (!headless) {
  startTrayServer();
}

process.on("SIGINT", () => {
  console.info("\nShutting down...");
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.info("\nShutting down...");
  server.stop();
  process.exit(0);
});
