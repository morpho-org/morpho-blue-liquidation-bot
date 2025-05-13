import { exec, execSync } from "node:child_process";

export const setup = async () => {
  try {
    const data = await execSync("lsof -c anvil -t");

    const pids = data.toString().split("\n").slice(0, -1);

    console.debug(`Clearing ports: ${pids.join(", ")}`);

    for (const pid of pids) {
      exec(`kill -9 ${pid}`, (error) => {
        if (error) console.error(`Error while killing ${pid}: ${error}`);
      });
    }
  } catch {}
};
