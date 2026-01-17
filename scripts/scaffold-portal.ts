import { scaffoldBusinessPortal } from "../server/services/webApp/portalScaffolder";
import { createChinaRussiaConfig } from "../server/services/webApp/portalConfig";

async function main() {
  const config = createChinaRussiaConfig("silk-road-portal", "/tmp");
  console.log("Locales:", config.countryPair.locales);
  console.log("Default:", config.countryPair.defaultLocale);
  console.log(
    "GeoJSON URLs:",
    config.geoDataSources.map(g => g.url)
  );

  const result = await scaffoldBusinessPortal(config);
  console.log("Success:", result.success);
  console.log("Files created:", result.filesCreated.length);
  console.log("Project path:", result.projectPath);

  if (!result.success) {
    console.error("Error:", result.error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
