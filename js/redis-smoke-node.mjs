#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function baseArgs() {
  const redisUrl = (process.env.REDIS_URL || '').trim();

  if (redisUrl) {
    return ['-u', redisUrl];
  }

  const host = (process.env.REDIS_HOST || '127.0.0.1').trim();
  const port = (process.env.REDIS_PORT || '6379').trim();
  const db = (process.env.REDIS_DB || '0').trim();
  const password = (process.env.REDIS_PASSWORD || process.env.REDISCLI_AUTH || '').trim();
  const args = ['-h', host, '-p', port, '-n', db];

  if (password) {
    args.push('-a', password);
  }

  return args;
}

function runRedis(commandArgs) {
  const proc = spawnSync('redis-cli', [...baseArgs(), ...commandArgs], {
    encoding: 'utf8'
  });

  if (proc.error) {
    throw new Error(`redis-cli failed to start: ${proc.error.message}`);
  }

  if (proc.status !== 0) {
    const details = (proc.stderr || proc.stdout || '').trim();
    throw new Error(`redis-cli exited with code ${proc.status}: ${details}`);
  }

  return (proc.stdout || '').trim();
}

function main() {
  const key = `smoke:node:${Date.now()}`;
  const value = 'ok-node';

  runRedis(['SET', key, value, 'EX', '30']);
  const got = runRedis(['--raw', 'GET', key]);

  if (got !== value) {
    throw new Error(`unexpected value for ${key}: "${got}"`);
  }

  runRedis(['DEL', key]);
  console.log('node redis smoke: ok');
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`node redis smoke: failed - ${message}`);
  process.exit(1);
}
