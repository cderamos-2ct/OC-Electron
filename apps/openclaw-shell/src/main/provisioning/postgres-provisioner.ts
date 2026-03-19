// PostgreSQL provisioner — detect, install, configure, migrate
// Bundles Postgres 18 + pgvector binaries in app extraResources

import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Provisioner, ProvisioningProgress } from './types.js';
import { ProvisioningStatus } from './types.js';
import {
  resolvePostgresBin,
  resolvePgVectorLib,
  getPostgresDataDir,
  getDataDir,
} from './platform.js';
import { createLogger } from '../logging/logger.js';

const execFileAsync = promisify(execFile);
const log = createLogger('PostgresProvisioner');

const PG_PORT = 5432;
const PG_DATABASE = 'openclaw';
const PG_USER = 'openclaw';

export class PostgresProvisioner implements Provisioner {
  readonly id = 'postgres';
  readonly name = 'PostgreSQL 18 + pgvector';

  private dataDir: string;
  private port: number;

  constructor(dataDir?: string, port?: number) {
    this.dataDir = dataDir ?? getPostgresDataDir();
    this.port = port ?? PG_PORT;
  }

  async check(): Promise<boolean> {
    try {
      const pgIsReady = resolvePostgresBin('pg_isready');
      const { stdout } = await execFileAsync(pgIsReady, [
        '-h', '127.0.0.1',
        '-p', String(this.port),
        '-d', PG_DATABASE,
        '-U', PG_USER,
      ], { timeout: 5_000 });
      return stdout.includes('accepting connections');
    } catch {
      // Also check if data dir exists with PG_VERSION (provisioned but not running)
      return existsSync(join(this.dataDir, 'PG_VERSION'));
    }
  }

  async provision(onProgress?: (p: ProvisioningProgress) => void): Promise<void> {
    const progress = (message: string, percent?: number) => {
      onProgress?.({ service: this.id, status: ProvisioningStatus.Running, message, percent });
    };

    // Step 1: Initialize data directory
    if (!existsSync(join(this.dataDir, 'PG_VERSION'))) {
      progress('Initializing database...', 10);
      await this.initDb();
    }

    // Step 2: Configure
    progress('Configuring PostgreSQL...', 30);
    this.writePostgresConf();
    this.writePgHbaConf();

    // Step 3: Start Postgres
    progress('Starting PostgreSQL...', 50);
    await this.start();

    // Wait for Postgres to be ready
    await this.waitForReady(10);

    // Step 4: Create database and user
    progress('Creating database and user...', 60);
    await this.createDatabaseAndUser();

    // Step 5: Install pgvector extension
    progress('Installing pgvector extension...', 70);
    await this.installPgVector();

    // Step 6: Run migrations
    progress('Running migrations...', 80);
    await this.runMigrations();

    // Step 7: Health check
    progress('Verifying...', 95);
    const healthy = await this.healthCheck();
    if (!healthy) {
      throw new Error('PostgreSQL health check failed after provisioning');
    }

    progress('PostgreSQL ready', 100);
  }

  async start(): Promise<void> {
    // Check if already running
    try {
      const pgIsReady = resolvePostgresBin('pg_isready');
      const { stdout } = await execFileAsync(pgIsReady, [
        '-h', '127.0.0.1', '-p', String(this.port),
      ], { timeout: 3_000 });
      if (stdout.includes('accepting connections')) {
        log.info('PostgreSQL already running.');
        return;
      }
    } catch {
      // Not running, proceed to start
    }

    const pgCtl = resolvePostgresBin('pg_ctl');
    const logFile = join(getDataDir(), 'postgres', 'postgres.log');

    try {
      await execFileAsync(pgCtl, [
        'start',
        '-D', this.dataDir,
        '-l', logFile,
        '-w', // wait for startup
        '-o', `-p ${this.port}`,
      ], {
        timeout: 30_000,
        env: {
          ...process.env,
          // Prevent PG18 "postmaster became multithreaded" on macOS
          LC_ALL: 'C',
          // Ensure pgvector can be found
          ...(existsSync(resolvePgVectorLib()) ? {
            LD_LIBRARY_PATH: join(resolvePgVectorLib(), '..'),
            DYLD_LIBRARY_PATH: join(resolvePgVectorLib(), '..'),
          } : {}),
        },
      });
      log.info('PostgreSQL started.');
    } catch (err) {
      log.error('Failed to start PostgreSQL:', err);
      throw new Error(`Failed to start PostgreSQL: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async stop(): Promise<void> {
    const pgCtl = resolvePostgresBin('pg_ctl');
    try {
      await execFileAsync(pgCtl, [
        'stop',
        '-D', this.dataDir,
        '-m', 'fast',
        '-w',
      ], { timeout: 15_000 });
      log.info('PostgreSQL stopped.');
    } catch (err) {
      log.warn('Failed to stop PostgreSQL (may not be running):', err);
    }
  }

  private async initDb(): Promise<void> {
    mkdirSync(this.dataDir, { recursive: true });
    const initdb = resolvePostgresBin('initdb');
    const pgLib = resolvePgVectorLib();
    const libDir = existsSync(pgLib) ? join(pgLib, '..') : undefined;

    await execFileAsync(initdb, [
      '--pgdata', this.dataDir,
      '--encoding', 'UTF8',
      '--locale', 'C',
      '--auth', 'trust',
      '--username', 'postgres',
    ], {
      timeout: 60_000,
      env: {
        ...process.env,
        ...(libDir ? {
          LD_LIBRARY_PATH: libDir,
          DYLD_LIBRARY_PATH: libDir,
        } : {}),
      },
    });

    log.info('initdb complete.');
  }

  private writePostgresConf(): void {
    const confPath = join(this.dataDir, 'postgresql.conf');
    const pgLib = resolvePgVectorLib();
    const libDir = existsSync(pgLib) ? join(pgLib, '..') : undefined;

    const conf = [
      `# Aegilume auto-generated PostgreSQL configuration`,
      `port = ${this.port}`,
      `listen_addresses = '127.0.0.1'`,
      `max_connections = 30`,
      `shared_buffers = 128MB`,
      `work_mem = 4MB`,
      `maintenance_work_mem = 64MB`,
      `effective_cache_size = 256MB`,
      `wal_level = minimal`,
      `max_wal_senders = 0`,
      `logging_collector = on`,
      `log_directory = 'log'`,
      `log_filename = 'postgresql-%Y-%m-%d.log'`,
      `log_truncate_on_rotation = on`,
      `log_rotation_age = 1d`,
      ...(libDir ? [`shared_preload_libraries = 'vector'`, `dynamic_library_path = '${libDir}:$libdir'`] : []),
    ].join('\n');

    writeFileSync(confPath, conf, 'utf-8');
    log.info('postgresql.conf written.');
  }

  private writePgHbaConf(): void {
    const hbaPath = join(this.dataDir, 'pg_hba.conf');
    const hba = [
      '# Aegilume auto-generated pg_hba.conf',
      '# TYPE  DATABASE  USER  ADDRESS  METHOD',
      'local   all       all            trust',
      'host    all       all   127.0.0.1/32  trust',
      'host    all       all   ::1/128       trust',
    ].join('\n');

    writeFileSync(hbaPath, hba, 'utf-8');
    log.info('pg_hba.conf written.');
  }

  private async waitForReady(maxRetries: number): Promise<void> {
    const pgIsReady = resolvePostgresBin('pg_isready');
    for (let i = 0; i < maxRetries; i++) {
      try {
        const { stdout } = await execFileAsync(pgIsReady, [
          '-h', '127.0.0.1', '-p', String(this.port),
        ], { timeout: 3_000 });
        if (stdout.includes('accepting connections')) return;
      } catch {
        // Not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    throw new Error(`PostgreSQL not ready after ${maxRetries} retries`);
  }

  private async createDatabaseAndUser(): Promise<void> {
    const psql = resolvePostgresBin('psql');

    // Create user (ignore if exists)
    try {
      await execFileAsync(psql, [
        '-h', '127.0.0.1', '-p', String(this.port),
        '-U', 'postgres',
        '-c', `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${PG_USER}') THEN CREATE ROLE ${PG_USER} LOGIN; END IF; END $$;`,
      ], { timeout: 10_000 });
    } catch (err) {
      log.warn('User creation (may already exist):', err);
    }

    // Create database (ignore if exists)
    try {
      await execFileAsync(psql, [
        '-h', '127.0.0.1', '-p', String(this.port),
        '-U', 'postgres',
        '-c', `SELECT 1 FROM pg_database WHERE datname = '${PG_DATABASE}'`,
      ], { timeout: 10_000 }).then(async ({ stdout }) => {
        if (!stdout.includes('1')) {
          const createdb = resolvePostgresBin('createdb');
          await execFileAsync(createdb, [
            '-h', '127.0.0.1', '-p', String(this.port),
            '-U', 'postgres',
            '-O', PG_USER,
            PG_DATABASE,
          ], { timeout: 10_000 });
        }
      });
    } catch (err) {
      log.warn('Database creation (may already exist):', err);
    }

    // Grant all privileges
    try {
      await execFileAsync(psql, [
        '-h', '127.0.0.1', '-p', String(this.port),
        '-U', 'postgres',
        '-d', PG_DATABASE,
        '-c', `GRANT ALL PRIVILEGES ON DATABASE ${PG_DATABASE} TO ${PG_USER}; GRANT ALL ON SCHEMA public TO ${PG_USER};`,
      ], { timeout: 10_000 });
    } catch (err) {
      log.warn('Grant privileges:', err);
    }
  }

  private async installPgVector(): Promise<void> {
    const psql = resolvePostgresBin('psql');
    try {
      await execFileAsync(psql, [
        '-h', '127.0.0.1', '-p', String(this.port),
        '-U', 'postgres',
        '-d', PG_DATABASE,
        '-c', 'CREATE EXTENSION IF NOT EXISTS vector;',
      ], { timeout: 10_000 });
      log.info('pgvector extension installed.');
    } catch (err) {
      log.warn('pgvector installation (may need bundled library):', err);
      // Non-fatal if pgvector binary isn't bundled yet — will be retried
    }
  }

  private async runMigrations(): Promise<void> {
    // Dynamic import to avoid pulling in the full db package at module level
    try {
      // openclaw-db is a workspace dependency — import via package name
      const mod = await import('openclaw-db');
      const runMig = (mod as Record<string, unknown>).runMigrations as (() => Promise<void>) | undefined;
      if (typeof runMig === 'function') {
        await runMig();
        log.info('All migrations applied.');
      } else {
        throw new Error('runMigrations not exported from openclaw-db');
      }
    } catch (err) {
      log.error('Migration failed:', err);
      throw new Error(`Migration failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async healthCheck(): Promise<boolean> {
    try {
      const psql = resolvePostgresBin('psql');
      const { stdout } = await execFileAsync(psql, [
        '-h', '127.0.0.1', '-p', String(this.port),
        '-U', PG_USER,
        '-d', PG_DATABASE,
        '-c', "SELECT count(*) FROM schema_migrations;",
      ], { timeout: 10_000 });
      // Should return a count >= 4 (our 4 migration files)
      const match = stdout.match(/(\d+)/);
      const count = match ? parseInt(match[1], 10) : 0;
      log.info(`Health check: ${count} migrations applied.`);
      return count >= 4;
    } catch (err) {
      log.error('Health check failed:', err);
      return false;
    }
  }
}
