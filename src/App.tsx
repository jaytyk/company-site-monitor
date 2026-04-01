/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useMemo } from 'react';
import { 
  Activity, 
  Clock as ClockIcon, 
  Server, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  ExternalLink, 
  Search,
  RefreshCw,
  Monitor
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';

dayjs.locale('ko');

interface RunSummary {
  runId: string;
  timestamp: string;
  summary: {
    total: number;
    success: number;
    fail: number;
  };
}

interface SiteItem {
  name: string;
  url: string;
  status: 'OK' | 'FAIL';
  error: string | null;
  screenshot: string | null;
}

interface DetailedReport {
  runId: string;
  timestamp: string;
  summary: {
    total: number;
    success: number;
    fail: number;
  };
  items: SiteItem[];
}

export default function App() {
  const [index, setIndex] = useState<RunSummary[]>([]);
  const [latestReport, setLatestReport] = useState<DetailedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [selectedSite, setSelectedSite] = useState<SiteItem | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const isStaticSite = window.location.hostname.includes('github.io');

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      
      // Try fetching from static reports directory first (relative path for GitHub Pages compatibility)
      // We try 'reports/index.json' which Vite will serve from the public folder
      let indexData: RunSummary[] = [];
      
      try {
        const staticRes = await fetch('reports/index.json');
        if (staticRes.ok) {
          indexData = await staticRes.json();
        } else if (!isStaticSite) {
          // Fallback to API if not on a static site
          const apiRes = await fetch('/api/reports/index');
          if (apiRes.ok) {
            indexData = await apiRes.json();
          }
        }
      } catch (e) {
        if (!isStaticSite) {
          const apiRes = await fetch('/api/reports/index');
          if (apiRes.ok) {
            indexData = await apiRes.json();
          }
        }
      }

      if (indexData.length > 0) {
        setIndex(indexData);
        await fetchLatestReport(indexData[0].runId);
      } else {
        // If no data found, don't throw error yet, just set empty index
        setIndex([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchLatestReport = async (runId: string) => {
    try {
      const latestRes = await fetch(`reports/${runId}.json`);
      if (latestRes.ok) {
        const latestData: DetailedReport = await latestRes.json();
        setLatestReport(latestData);
      }
    } catch (error) {
      console.error('Error fetching latest report:', error);
    }
  };

  const handleRunAll = async () => {
    if (isMonitoring || isStaticSite) return;
    try {
      setIsMonitoring(true);
      const res = await fetch('/api/monitor/all', { method: 'POST' });
      
      if (res.status === 405 || res.status === 404) {
        throw new Error('Monitoring server is not available on this static site. Please use the App URL (Cloud Run) for live monitoring.');
      }
      
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned an invalid response. This might be a static site without a backend.');
      }

      const data = await res.json();
      if (data.success) {
        await fetchData(false);
      } else {
        alert('Monitor failed: ' + data.error);
      }
    } catch (error: any) {
      console.error('Error running monitor:', error);
      alert(error.message || 'Error running monitor');
    } finally {
      setIsMonitoring(false);
    }
  };

  const handleRunSite = async (siteName: string) => {
    if (isMonitoring || isStaticSite) return;
    try {
      setIsMonitoring(true);
      const res = await fetch(`/api/monitor/site/${siteName}`, { method: 'POST' });
      
      if (res.status === 405 || res.status === 404) {
        throw new Error('Monitoring server is not available on this static site. Please use the App URL (Cloud Run) for live monitoring.');
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned an invalid response. This might be a static site without a backend.');
      }

      const data = await res.json();
      if (data.success) {
        await fetchData(false);
        // Update selected site if it was the one we just ran
        if (selectedSite?.name === siteName) {
          const updatedSite = data.results.items.find((s: SiteItem) => s.name === siteName);
          if (updatedSite) setSelectedSite(updatedSite);
        }
      } else {
        alert('Monitor failed: ' + data.error);
      }
    } catch (error: any) {
      console.error('Error running monitor:', error);
      alert(error.message || 'Error running monitor');
    } finally {
      setIsMonitoring(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredSites = useMemo(() => {
    if (!latestReport) return [];
    return latestReport.items.filter(site => 
      site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.url.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [latestReport, searchTerm]);

  const historyChartData = useMemo(() => {
    return [...index].reverse().map(run => ({
      time: dayjs(run.timestamp).format('HH:mm'),
      success: run.summary.success,
      fail: run.summary.fail,
      total: run.summary.total
    }));
  }, [index]);

  if (loading && index.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1a1b1e]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-[#4dabf7] animate-spin mx-auto mb-4" />
          <p className="text-[#909296] font-mono uppercase tracking-widest">Initializing Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      {/* Left Column: Clock & Stats */}
      <div className="flex flex-col gap-6 overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card"
        >
          <div className="section-title">
            <ClockIcon size={14} />
            Today
          </div>
          <div className="clock-text">
            {currentTime.format('A h:mm')}
            <span className="text-2xl ml-2 opacity-50">{currentTime.format('ss')}</span>
          </div>
          <div className="date-text mt-2">
            {currentTime.format('YYYY년 M월 D일 dddd')}
          </div>
          <div className="mt-6 flex justify-center items-center p-4 bg-white/5 rounded-xl border border-white/5">
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Nexon_logo.svg/1024px-Nexon_logo.svg.png" 
              alt="NEXON Logo" 
              className="h-8 opacity-80 hover:opacity-100 transition-opacity brightness-0 invert"
              referrerPolicy="no-referrer"
            />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card flex-1 overflow-hidden flex flex-col"
        >
          <div className="section-title">
            <Activity size={14} />
            System Usage History
          </div>
          <div className="flex-1 min-h-[220px] relative">
            <div className="absolute inset-0 flex items-center justify-center">
              {historyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={historyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#40c057" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#40c057" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#25262b', border: '1px solid #373a40', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="success" stroke="#40c057" fillOpacity={1} fill="url(#colorSuccess)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-[#909296] text-xs font-mono opacity-50">No history data available</div>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="p-3 bg-white/5 rounded-lg text-center">
              <div className="text-xs text-[#909296] uppercase mb-1">Total</div>
              <div className="text-xl font-bold">{latestReport?.summary.total || 0}</div>
            </div>
            <div className="p-3 bg-white/5 rounded-lg text-center">
              <div className="text-xs text-[#909296] uppercase mb-1">Up</div>
              <div className="text-xl font-bold text-[#40c057]">{latestReport?.summary.success || 0}</div>
            </div>
            <div className="p-3 bg-white/5 rounded-lg text-center">
              <div className="text-xs text-[#909296] uppercase mb-1">Down</div>
              <div className="text-xl font-bold text-[#fa5252]">{latestReport?.summary.fail || 0}</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Center Column: Server List */}
      <div className="flex flex-col gap-6 overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card flex-1 flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="section-title mb-0">
              <Server size={14} />
              Server List
            </div>
            <div className="flex items-center gap-3">
              {isStaticSite && (
                <span className="text-[10px] text-[#fa5252] bg-[#fa5252]/10 px-2 py-1 rounded border border-[#fa5252]/20">
                  Static Mode (Read Only)
                </span>
              )}
              <button 
                onClick={() => fetchData(true)}
                disabled={loading || isMonitoring}
                className={`p-1.5 rounded-full transition-all ${
                  loading || isMonitoring
                    ? 'text-[#909296] cursor-not-allowed'
                    : 'text-[#4dabf7] hover:bg-[#4dabf7]/10'
                }`}
                title="Refresh Data"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button 
                onClick={handleRunAll}
                disabled={isMonitoring || isStaticSite}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isMonitoring || isStaticSite
                    ? 'bg-white/5 text-[#909296] cursor-not-allowed opacity-50' 
                    : 'bg-[#4dabf7]/10 text-[#4dabf7] hover:bg-[#4dabf7]/20'
                }`}
                title={isStaticSite ? "Cannot run monitor on static site" : "Run All Monitors"}
              >
                <RefreshCw size={12} className={isMonitoring ? 'animate-spin' : ''} />
                {isMonitoring ? 'Running...' : 'Run All'}
              </button>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#909296]" />
                <input 
                  type="text" 
                  placeholder="Search sites..."
                  className="bg-white/5 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:border-[#4dabf7] w-48 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              <div className="site-grid">
                {filteredSites.map((site, idx) => (
                  <motion.div
                    key={site.name}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`site-card ${selectedSite?.name === site.name ? 'border-[#4dabf7]' : ''}`}
                    onClick={() => setSelectedSite(site)}
                  >
                    <div className="site-icon">
                      <Monitor size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{site.name}</span>
                        <div className={`status-dot ${site.status === 'OK' ? 'success' : 'fail'}`} />
                      </div>
                      <div className="text-xs text-[#909296] truncate">{site.url}</div>
                    </div>
                    {site.status === 'FAIL' && (
                      <AlertCircle size={16} className="text-[#fa5252]" />
                    )}
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Right Column: Details & History */}
      <div className="flex flex-col gap-6 overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card h-1/2 flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="section-title mb-0">
              <ExternalLink size={14} />
              Site Details
            </div>
            {selectedSite && (
              <button 
                onClick={() => handleRunSite(selectedSite.name)}
                disabled={isMonitoring || isStaticSite}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isMonitoring || isStaticSite
                    ? 'bg-white/5 text-[#909296] cursor-not-allowed opacity-50' 
                    : 'bg-[#4dabf7]/10 text-[#4dabf7] hover:bg-[#4dabf7]/20'
                }`}
                title={isStaticSite ? "Cannot run monitor on static site" : "Run Monitor for this site"}
              >
                <RefreshCw size={12} className={isMonitoring ? 'animate-spin' : ''} />
                Run Now
              </button>
            )}
          </div>
          {selectedSite ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="aspect-video bg-black/40 rounded-lg overflow-hidden border border-white/5 mb-4 group relative">
                {selectedSite.screenshot ? (
                  <img 
                    src={`screenshots/${selectedSite.screenshot}`} 
                    alt={selectedSite.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#909296]">
                    No Screenshot Available
                  </div>
                )}
                <a 
                  href={selectedSite.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-sm font-medium"
                >
                  Visit Website <ExternalLink size={14} />
                </a>
              </div>
              <div className="flex-1 overflow-y-auto">
                <h3 className="text-lg font-bold mb-2">{selectedSite.name}</h3>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${selectedSite.status === 'OK' ? 'bg-[#40c057]/20 text-[#40c057]' : 'bg-[#fa5252]/20 text-[#fa5252]'}`}>
                    {selectedSite.status}
                  </span>
                  <span className="text-xs text-[#909296]">{selectedSite.url}</span>
                </div>
                {selectedSite.error && (
                  <div className="p-3 bg-[#fa5252]/10 border border-[#fa5252]/20 rounded-lg text-xs text-[#fa5252] font-mono">
                    {selectedSite.error}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#909296] text-center p-6">
              <Monitor size={48} className="mb-4 opacity-20" />
              <p className="text-sm">Select a server to view details and screenshots</p>
            </div>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card flex-1 flex flex-col overflow-hidden"
        >
          <div className="section-title">
            <History size={14} />
            Recent Runs
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {index.slice(0, 10).map((run) => (
              <div key={run.runId} className="p-3 bg-white/5 rounded-lg flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer">
                <div>
                  <div className="text-xs font-mono">{run.runId}</div>
                  <div className="text-[10px] text-[#909296]">{dayjs(run.timestamp).format('YYYY-MM-DD HH:mm:ss')}</div>
                </div>
                <div className="flex gap-2 text-[10px] font-bold">
                  <span className="text-[#40c057]">{run.summary.success}</span>
                  <span className="text-[#fa5252]">{run.summary.fail}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
