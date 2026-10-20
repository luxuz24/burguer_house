import { describe, it, expect } from 'vitest';
import { construirConfiguracaoPool } from './prisma.js';

describe('construirConfiguracaoPool (PrismaPg)', () => {
	it('aplica defaults resilientes para cold start e conexões ociosas', () => {
		const config = construirConfiguracaoPool({
			NODE_ENV: 'production',
			DATABASE_URL: 'postgresql://user:pass@ep-neon.aws.neon.tech/neondb?sslmode=require',
		});

		expect(config).toEqual({
			connectionString: 'postgresql://user:pass@ep-neon.aws.neon.tech/neondb?sslmode=require',
			max: 10,
			connectionTimeoutMillis: 10_000,
			idleTimeoutMillis: 30_000,
			keepAlive: true,
			keepAliveInitialDelayMillis: 10_000,
		});
	});

	it('prioriza DATABASE_URL_TEST quando NODE_ENV=test', () => {
		const config = construirConfiguracaoPool({
			NODE_ENV: 'test',
			DATABASE_URL: 'postgresql://localhost:5432/dev',
			DATABASE_URL_TEST: 'postgresql://localhost:5433/test',
		});

		expect(config.connectionString).toBe('postgresql://localhost:5433/test');
	});

	it('permite sobrescrever limites via variáveis de ambiente e ignora valores inválidos', () => {
		const custom = construirConfiguracaoPool({
			NODE_ENV: 'production',
			DATABASE_URL: 'postgresql://localhost:5432/prod',
			DB_POOL_MAX: '20',
			DB_CONNECT_TIMEOUT_MS: '15000',
			DB_IDLE_TIMEOUT_MS: '45000',
		});

		expect(custom.max).toBe(20);
		expect(custom.connectionTimeoutMillis).toBe(15_000);
		expect(custom.idleTimeoutMillis).toBe(45_000);

		const invalido = construirConfiguracaoPool({
			NODE_ENV: 'production',
			DATABASE_URL: 'postgresql://localhost:5432/prod',
			DB_POOL_MAX: '-5',
			DB_CONNECT_TIMEOUT_MS: 'abc',
			DB_IDLE_TIMEOUT_MS: '0',
		});

		expect(invalido.max).toBe(10);
		expect(invalido.connectionTimeoutMillis).toBe(10_000);
		expect(invalido.idleTimeoutMillis).toBe(30_000);
	});
});
