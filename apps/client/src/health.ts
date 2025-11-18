import type { FastifyInstance } from "fastify";
import Fastify from "fastify";

class HealthServer {
  private fastify: FastifyInstance;
  private port: number;
  private host: string;

  constructor(port = 3000, host = "0.0.0.0") {
    this.port = port;
    this.host = host;
    this.fastify = Fastify({
      logger: false,
    });

    this.setupRoutes();
  }

  private setupRoutes() {
    this.fastify.get("/health", async (request, reply) => {
      return reply.code(200).send({ status: "ok" });
    });
  }

  async start() {
    try {
      await this.fastify.listen({ port: this.port, host: this.host });
      console.log(`🚀 Health server listening on http://${this.host}:${this.port}`);
    } catch (err) {
      this.fastify.log.error(err);
      throw err;
    }
  }

  async stop() {
    await this.fastify.close();
  }
}

// Singleton instance
let healthServerInstance: HealthServer | null = null;

export function getHealthServer(port?: number, host?: string): HealthServer {
  if (!healthServerInstance) {
    const serverPort =
      port ?? Number.parseInt(process.env.PORT ?? process.env.HEALTH_SERVER_PORT ?? "3000", 10);
    const serverHost = host ?? process.env.HEALTH_SERVER_HOST ?? "0.0.0.0";
    healthServerInstance = new HealthServer(serverPort, serverHost);
  }
  return healthServerInstance;
}

export async function startHealthServer(port?: number, host?: string): Promise<HealthServer> {
  const server = getHealthServer(port, host);
  await server.start();
  return server;
}
