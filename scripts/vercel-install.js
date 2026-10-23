import { spawnSync } from "node:child_process";
import process from "node:process";

const npmEnvironment = { ...process.env };
for (const name of ["npm_config_cache_dir", "NPM_CONFIG_CACHE_DIR", "npm_config_cache-dir", "NPM_CONFIG_CACHE-DIR"]) {
  delete npmEnvironment[name];
}

console.log(`KLYRO Vercel install script active (Node ${process.version}); removed deprecated npm cache-dir environment config.`);

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
for (const args of [["install"], ["install", "--prefix", "server"]]) {
  const result = spawnSync(npmCommand, args, {
    env: npmEnvironment,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    console.error(`Could not run ${npmCommand} ${args.join(" ")}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
