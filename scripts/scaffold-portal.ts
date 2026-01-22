import { scaffoldBusinessPortal } from "../server/services/webApp/portalScaffolder";
import { createChinaRussiaConfig } from "../server/services/webApp/portalConfig";

async function main() {
  const config = createChinaRussiaConfig("silk-road-portal", "/tmp");
  console.info("Locales:", config.countryPair.locales);
  console.info("Default:", config.countryPair.defaultLocale);
  console.info(
    "GeoJSON URLs:",
    config.geoDataSources.map(g => g.url)
  );

  const result = await scaffoldBusinessPortal(config);
  console.info("Success:", result.success);
  console.info("Files created:", result.filesCreated.length);
  console.info("Project path:", result.projectPath);

  if (!result.success) {
    console.error("Error:", result.error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
