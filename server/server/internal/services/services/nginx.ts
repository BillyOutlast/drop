import { spawn } from "node:child_process";
import { Service } from "..";
import { systemConfig } from "../../config/sys-conf";
import path from "node:path";
import fs from "node:fs";

function resolveNginxPath(): string {
  const knownPaths = [
    "/usr/sbin/nginx",
    "/usr/local/bin/nginx",
    "/usr/bin/nginx",
  ];
  for (const p of knownPaths) {
    if (fs.existsSync(p)) return p;
  }
  return "nginx";
}

export const NGINX_SERVICE = new Service(
  "nginx",
  () => {
    const nginxConfig = path.resolve(
      process.env.NGINX_CONFIG ?? "./build/nginx.conf",
    );
    const nginxPrefix = path.join(systemConfig.getDataFolder(), "nginx");
    fs.mkdirSync(nginxPrefix, { recursive: true });
    const nginxPath = resolveNginxPath();

    return spawn(nginxPath, ["-c", nginxConfig, "-p", nginxPrefix]);
  },
  undefined,
  async () => {
    try {
      await $fetch(`http://127.0.0.1:8080/`, {
        signal: AbortSignal.timeout(5000),
      });
      return true;
    } catch {
      return false;
    }
  },
);
