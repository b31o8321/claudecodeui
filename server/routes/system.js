import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { projectsDb } from '../modules/database/index.js';

const router = express.Router();

/**
 * GET /api/system/stats-cache
 * Returns the contents of ~/.claude/stats-cache.json or { dailyActivity: [] }
 */
router.get('/stats-cache', async (_req, res) => {
  try {
    const statsCachePath = path.join(os.homedir(), '.claude', 'stats-cache.json');
    if (!fs.existsSync(statsCachePath)) {
      return res.json({ dailyActivity: [] });
    }
    const raw = fs.readFileSync(statsCachePath, 'utf8');
    res.json(JSON.parse(raw));
  } catch {
    res.json({ dailyActivity: [] });
  }
});

/**
 * GET /api/system/project-meta?projectId=X
 * Returns { gitBranch, claudeMdCount, mcpServerCount }
 */
router.get('/project-meta', async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }

  // Resolve project path from DB
  let projectPath = null;
  try {
    projectPath = projectsDb.getProjectPathById(String(projectId));
  } catch {
    // ignore
  }

  // Git branch
  let gitBranch = null;
  if (projectPath) {
    try {
      gitBranch = execSync(`git -C "${projectPath}" rev-parse --abbrev-ref HEAD`, {
        encoding: 'utf8',
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      gitBranch = null;
    }
  }

  // CLAUDE.md count
  let claudeMdCount = 0;
  if (projectPath) {
    try {
      const rootMd = path.join(projectPath, 'CLAUDE.md');
      const dotClaudeMd = path.join(projectPath, '.claude', 'CLAUDE.md');
      if (fs.existsSync(rootMd)) claudeMdCount++;
      if (fs.existsSync(dotClaudeMd)) claudeMdCount++;
    } catch {
      claudeMdCount = 0;
    }
  }

  // MCP server count
  let mcpServerCount = 0;
  if (projectPath) {
    try {
      const mcpJsonPath = path.join(projectPath, '.claude', 'mcp.json');
      if (fs.existsSync(mcpJsonPath)) {
        const mcpJson = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));
        mcpServerCount += Object.keys(mcpJson.mcpServers || {}).length;
      }
    } catch {
      // ignore
    }
  }
  // Also count global ~/.claude/mcp_servers/*.json
  try {
    const globalMcpDir = path.join(os.homedir(), '.claude', 'mcp_servers');
    if (fs.existsSync(globalMcpDir)) {
      const files = fs.readdirSync(globalMcpDir).filter(f => f.endsWith('.json'));
      mcpServerCount += files.length;
    }
  } catch {
    // ignore
  }

  res.json({ gitBranch, claudeMdCount, mcpServerCount });
});

/**
 * GET /api/system/today-activity
 * Returns today's activity row from ~/.claude/stats-cache.json, or null if absent.
 * Response: { date, messageCount, sessionCount, toolCallCount } | null
 */
router.get('/today-activity', async (_req, res) => {
  try {
    const statsCachePath = path.join(os.homedir(), '.claude', 'stats-cache.json');
    if (!fs.existsSync(statsCachePath)) {
      return res.json(null);
    }
    const raw = fs.readFileSync(statsCachePath, 'utf8');
    const data = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    const todayRow = (data?.dailyActivity || []).find((row) => row.date === today) ?? null;
    res.json(todayRow);
  } catch {
    res.json(null);
  }
});

export default router;
