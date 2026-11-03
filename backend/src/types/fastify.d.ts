import "fastify";

declare module "fastify" {
  interface FastifyContextConfig {
    /** This GET/HEAD route performs lazy state reconciliation and must pass the maintenance write gate. */
    maintenanceWrite?: boolean;
  }
}
