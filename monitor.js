/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import dayjs from 'dayjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main monitoring function
 * @param {string|null} targetSiteName - Optional site name to monitor only one site
 */
export async function runMonitor(targetSiteName = null) {
  const runId = dayjs().format('YYYYMMDD_HHmmss');
  const timestamp = dayjs().toISOString();
  const reportsDir = path.join(__dirname, 'reports');
  const screenshotsDir = path.join(__dirname, 'screenshots', runId);

  // Ensure directories exist
  await fs.ensureDir(reportsDir);
  await fs.ensureDir(screenshotsDir);

  // Read sites to monitor
  const sitesPath = path.join(__dirname, 'sites.json');
  let config;
  try {
    config = await fs.readJson(sitesPath);
  } catch (e) {
    throw new Error(`Failed to read sites.json: ${e.message}`);
  }

  // Handle both array-only and object-with-settings structures
  let sites = Array.isArray(config) ? config : config.sites;
  const settings = Array.isArray(config) ? {} : (config.settings || {});

  if (!Array.isArray(sites)) {
    console.error('Debug: config content:', config);
    throw new Error(`sites.json must contain a "sites" array. Please check the file format.`);
  }

  // Filter if targetSiteName is provided
  if (targetSiteName && targetSiteName !== 'All') {
    sites = sites.filter(s => s.name === targetSiteName);
    if (sites.length === 0) {
      throw new Error(`Site "${targetSiteName}" not found in config.`);
    }
  }

  const results = {
    runId,
    timestamp,
    summary: {
      total: sites.length,
      success: 0,
      fail: 0
    },
    items: []
  };

  console.log(`Starting monitor run: ${runId} ${targetSiteName ? `(Target: ${targetSiteName})` : ''}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: settings.viewport || { width: 1280, height: 720 }
  });

  const timeoutMs = settings.timeoutMs || 45000;

  // Process all sites in parallel simultaneously
  await Promise.all(sites.map(async (site) => {
    const page = await context.newPage();
    console.log(`Monitoring: ${site.name} (${site.url})`);
    
    const item = {
      name: site.name,
      url: site.url,
      status: 'OK',
      error: null,
      screenshot: null
    };

    try {
      // Navigate with configured timeout
      await page.goto(site.url, { 
        waitUntil: site.waitUntil || 'networkidle', 
        timeout: timeoutMs 
      });
      
      // Capture screenshot
      const screenshotPath = `screenshots/${runId}/${site.name.replace(/\s+/g, '_')}.png`;
      await page.screenshot({ path: path.join(__dirname, screenshotPath) });
      item.screenshot = screenshotPath;
      
      results.summary.success++;
    } catch (error) {
      console.error(`Failed to monitor ${site.name}: ${error.message}`);
      item.status = 'FAIL';
      item.error = error.message;
      results.summary.fail++;
    } finally {
      results.items.push(item);
      await page.close();
    }
  }));

  await browser.close();

  // Save detailed report
  const reportFile = path.join(reportsDir, `${runId}.json`);
  await fs.writeJson(reportFile, results, { spaces: 2 });

  // Update index.json
  const indexPath = path.join(reportsDir, 'index.json');
  let index = [];
  if (await fs.pathExists(indexPath)) {
    index = await fs.readJson(indexPath);
  }
  index.unshift({
    runId,
    timestamp,
    summary: results.summary
  });
  // Keep configured number of runs or default to 50
  const retention = settings.retentionRuns || 50;
  await fs.writeJson(indexPath, index.slice(0, retention), { spaces: 2 });

  console.log(`Monitor run complete. Success: ${results.summary.success}, Fail: ${results.summary.fail}`);

  // Send notifications
  await sendNotifications(results);
  
  return results;
}

/**
 * Send notifications to Slack and Teams
 */
async function sendNotifications(results) {
  const { SLACK_WEBHOOK_URL, TEAMS_WEBHOOK_URL } = process.env;
  
  const message = `*Site Monitor Report (${results.runId})*\n` +
    `Total: ${results.summary.total}\n` +
    `Success: ${results.summary.success}\n` +
    `Fail: ${results.summary.fail}\n` +
    (results.summary.fail > 0 ? `\n*Alert: Some sites are down!*` : `\nAll systems operational.`);

  if (SLACK_WEBHOOK_URL) {
    try {
      await axios.post(SLACK_WEBHOOK_URL, { text: message });
      console.log('Slack notification sent.');
    } catch (e) {
      console.error('Failed to send Slack notification:', e.message);
    }
  }

  if (TEAMS_WEBHOOK_URL) {
    try {
      await axios.post(TEAMS_WEBHOOK_URL, {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": results.summary.fail > 0 ? "FF0000" : "00FF00",
        "summary": "Site Monitor Report",
        "sections": [{
          "activityTitle": "Site Monitor Report",
          "activitySubtitle": results.timestamp,
          "facts": [
            { "name": "Total", "value": results.summary.total.toString() },
            { "name": "Success", "value": results.summary.success.toString() },
            { "name": "Fail", "value": results.summary.fail.toString() }
          ],
          "markdown": true
        }]
      });
      console.log('Teams notification sent.');
    } catch (e) {
      console.error('Failed to send Teams notification:', e.message);
    }
  }
}

// Run if called directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targetSite = process.argv[2];
  runMonitor(targetSite).catch(err => {
    console.error('Fatal error in monitor:', err);
    process.exit(1);
  });
}
