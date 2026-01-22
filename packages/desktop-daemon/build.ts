import { $ } from "bun";
import { mkdir } from "fs/promises";

const targets = [
  { target: "bun-darwin-arm64", name: "rasputin-daemon-macos-arm64" },
  { target: "bun-darwin-x64", name: "rasputin-daemon-macos-x64" },
  { target: "bun-linux-x64", name: "rasputin-daemon-linux-x64" },
  { target: "bun-linux-arm64", name: "rasputin-daemon-linux-arm64" },
  { target: "bun-windows-x64", name: "rasputin-daemon-win-x64.exe" },
];

await mkdir("dist", { recursive: true });

for (const { target, name } of targets) {
  console.info(`Building for ${target}...`);
  try {
    await $`bun build --compile --target=${target} ./src/index.ts --outfile=dist/${name}`;
    console.info(`  ✓ dist/${name}`);
  } catch (error) {
    console.error(`  ✗ Failed: ${error}`);
  }
}

console.info("\nBuild complete!");
