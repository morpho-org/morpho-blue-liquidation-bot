import { randomUUID } from "crypto";
import { access, mkdir, readFile, rename, unlink, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { DebouncedStore, type Store } from "@morpho-org/viem-dlc";
import { CompressedStore } from "@morpho-org/viem-dlc/stores/compressed";

export class NodeFsStore implements Store {
  constructor(private readonly base: string) {}

  private resolvePath(key: string) {
    return join(this.base, key);
  }

  async get(key: string): Promise<string | null> {
    const path = this.resolvePath(key);
    try {
      return await readFile(path, "utf8");
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    const path = this.resolvePath(key);

    const dir = dirname(path);
    try {
      await access(dir);
    } catch {
      await mkdir(dir, { recursive: true });
    }

    // Atomic write: write to temp file, then rename
    const tempPath = join(dir, `.tmp-${randomUUID()}`);
    await writeFile(tempPath, value, "utf8");
    await rename(tempPath, path);
  }

  async delete(key: string): Promise<void> {
    const path = this.resolvePath(key);
    try {
      await unlink(path);
    } catch {
      // File doesn't exist, ignore
    }
  }
}

export function createOptimizedNodeFsStore(options: { base: string; maxWritesPerSecond: number }) {
  const remote = new NodeFsStore(options.base);

  return new DebouncedStore(new CompressedStore(remote), {
    debounceMs: 2000,
    maxStalenessMs: 10000,
    maxWritesBurst: options.maxWritesPerSecond,
    maxWritesPerSecond: options.maxWritesPerSecond,
  });
}
