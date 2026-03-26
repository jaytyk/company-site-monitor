/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { runMonitor } from "./monitor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Serve monitoring reports and screenshots
  app.use('/reports', express.static(path.join(__dirname, 'reports')));
  app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Trigger monitor for all sites
  app.post("/api/monitor/all", async (req, res) => {
    try {
      const results = await runMonitor();
      res.json({ success: true, results });
    } catch (error) {
      console.error('Monitor error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Trigger monitor for a specific site
  app.post("/api/monitor/site/:name", async (req, res) => {
    try {
      const results = await runMonitor(req.params.name);
      res.json({ success: true, results });
    } catch (error) {
      console.error('Monitor error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get index of reports
  app.get("/api/reports/index", async (req, res) => {
    try {
      const fs = await import('fs-extra');
      const indexPath = path.join(__dirname, 'reports', 'index.json');
      if (await fs.default.pathExists(indexPath)) {
        const index = await fs.default.readJson(indexPath);
        res.json(index);
      } else {
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
