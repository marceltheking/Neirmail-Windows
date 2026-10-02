import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const [packageJson, tauriConfig, currentVersion] = await Promise.all([
  readJson("package.json"),
  readJson("src-tauri/tauri.conf.json"),
  readJson("current-version.json"),
]);

const versions = [packageJson.version, tauriConfig.version, currentVersion.version];

if (new Set(versions).size !== 1) {
  throw new Error(`Version mismatch: ${versions.join(", ")}`);
}

if (currentVersion.tag !== `v${currentVersion.version}`) {
  throw new Error("current-version.json tag does not match its version");
}

if (!currentVersion.release.endsWith(`/tag/${currentVersion.tag}`)) {
  throw new Error("current-version.json release URL does not match its tag");
}

process.stdout.write(`Neir Mail ${currentVersion.version}\n`);
