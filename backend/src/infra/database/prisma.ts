import 'dotenv/config';
import type pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client.js';

function lerInteiroPositivo(valor: string | undefined, padrao: number): number {
	if (!valor) return padrao;
	const numero = Number.parseInt(valor, 10);
	return Number.isFinite(numero) && numero > 0 ? numero : padrao;
}

export function construirConfiguracaoPool(env: NodeJS.ProcessEnv = process.env): pg.PoolConfig {
	const connectionString =
		env.NODE_ENV === 'test' && env.DATABASE_URL_TEST ? env.DATABASE_URL_TEST : env.DATABASE_URL!;

	return {
		connectionString,
		max: lerInteiroPositivo(env.DB_POOL_MAX, 10),
		// 10s acomoda cold start de bancos serverless (ex.: Neon acordando)
		connectionTimeoutMillis: lerInteiroPositivo(env.DB_CONNECT_TIMEOUT_MS, 10_000),
		// Fecha conexões ociosas antes que proxies externos encerrem o socket silenciosamente
		idleTimeoutMillis: lerInteiroPositivo(env.DB_IDLE_TIMEOUT_MS, 30_000),
		keepAlive: true,
		keepAliveInitialDelayMillis: 10_000,
	};
}

const adapter = new PrismaPg(construirConfiguracaoPool(), {
	onPoolError(err) {
		console.error('[PrismaPg] Erro inesperado em cliente ocioso do pool PostgreSQL:', err.message);
	},
	onConnectionError(err) {
		console.error('[PrismaPg] Erro de conexão PostgreSQL:', err.message);
	},
});

export const prisma = new PrismaClient({ adapter });

