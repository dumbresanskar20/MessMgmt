import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Database, Table, FileSpreadsheet, HardDrive, Download, 
  ChevronDown, ChevronUp, Key, ListFilter, Play, CheckCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function DbExplorer() {
  const navigate = useNavigate();
  const [expandedTable, setExpandedTable] = useState(null);

  // 1. Fetch tables list & metadata
  const { data: dbData, isLoading, refetch } = useQuery({
    queryKey: ['devDatabaseTables'],
    queryFn: async () => {
      const res = await axios.get('/api/developer/database/tables');
      return res.data;
    },
  });

  const handleDownloadBackup = () => {
    toast.promise(
      new Promise(async (resolve, reject) => {
        try {
          // Open backup link in new tab or trigger manual download
          const response = await axios.get('/api/developer/database/backup', { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `mess_db_backup_${new Date().toISOString().slice(0, 10)}.sql`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          resolve();
        } catch (error) {
          reject(error);
        }
      }),
      {
        loading: 'Generating database SQL dump...',
        success: 'SQL backup downloaded successfully',
        error: 'Failed to generate database backup',
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-sm text-dark-400">Querying Database Tables...</p>
        </div>
      </div>
    );
  }

  const tables = dbData?.tables || [];
  const metrics = dbData?.databaseMetrics || {};

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const toggleTable = (tableName) => {
    if (expandedTable === tableName) {
      setExpandedTable(null);
    } else {
      setExpandedTable(tableName);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Backup button */}
      <div className="flex flex-col justify-between space-y-4 md:flex-row md:items-center md:space-y-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <Database size={20} className="text-indigo-400" />
            <span>Database Explorer & Schema Inspector</span>
          </h2>
          <p className="text-sm text-dark-400">Analyze table physical structures, rows capacity, columns, primary keys, and indexes.</p>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => refetch()} 
            className="flex items-center space-x-1.5 rounded-lg border border-dark-800 bg-dark-900 px-3.5 py-2 text-xs font-semibold text-dark-200 hover:text-white cursor-pointer"
          >
            Refresh Structure
          </button>
          <button 
            onClick={handleDownloadBackup}
            className="flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-md cursor-pointer transition duration-150"
          >
            <Download size={14} />
            <span>Export Database SQL Dump</span>
          </button>
        </div>
      </div>

      {/* Database Storage metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-card rounded-xl p-5 flex items-center space-x-4">
          <div className="rounded-lg bg-indigo-500/10 p-3 text-indigo-400 shrink-0">
            <Database size={24} />
          </div>
          <div>
            <span className="text-xs text-dark-400 block font-medium">Physical Database Size</span>
            <span className="text-2xl font-bold text-white tracking-tight">{formatBytes(metrics.totalSize)}</span>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 flex items-center space-x-4">
          <div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-400 shrink-0">
            <Table size={24} />
          </div>
          <div>
            <span className="text-xs text-dark-400 block font-medium">Total Tables Registered</span>
            <span className="text-2xl font-bold text-white tracking-tight">{metrics.totalTables}</span>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5 flex items-center space-x-4">
          <div className="rounded-lg bg-amber-500/10 p-3 text-amber-400 shrink-0">
            <HardDrive size={24} />
          </div>
          <div>
            <span className="text-xs text-dark-400 block font-medium">Database Health Status</span>
            <span className="text-2xl font-bold text-white tracking-tight flex items-center space-x-1.5">
              <span>{metrics.status}</span>
              <CheckCircle size={18} className="text-emerald-500 inline" />
            </span>
          </div>
        </div>
      </div>

      {/* Tables Grid List */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-white">Database Schema Tables</h3>

        <div className="grid gap-4">
          {tables.map((table) => {
            const isExpanded = expandedTable === table.name;
            return (
              <div 
                key={table.name}
                className="glass-panel rounded-xl overflow-hidden border border-dark-850 bg-dark-900/40"
              >
                {/* Table Header Bar */}
                <div 
                  onClick={() => toggleTable(table.name)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-dark-800/30 transition duration-150"
                >
                  <div className="flex items-center space-x-3">
                    <Table size={18} className="text-indigo-400" />
                    <div>
                      <span className="font-semibold text-white">{table.name}</span>
                      <span className="ml-2 text-[10px] rounded bg-dark-800 px-1.5 py-0.5 text-dark-400">
                        {table.rows} rows
                      </span>
                      <span className="ml-2 text-[10px] text-dark-500">
                        ({formatBytes(table.size)})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => navigate(`/crud/${table.name}`)}
                      className="flex items-center space-x-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-1.5 text-xs text-indigo-400 hover:bg-indigo-600/10 cursor-pointer"
                    >
                      <Play size={12} />
                      <span>Open Table View</span>
                    </button>
                    <button 
                      onClick={() => toggleTable(table.name)}
                      className="rounded p-1 text-dark-400 hover:bg-dark-800 hover:text-white"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Table Structural Meta Detail (Expanded) */}
                {isExpanded && (
                  <div className="border-t border-dark-800 p-4 bg-[#0d0d11]/80 space-y-4">
                    {/* Columns structure */}
                    <div>
                      <h4 className="text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Column Definitions</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs border border-dark-800 rounded-lg">
                          <thead className="bg-dark-900 text-dark-300">
                            <tr>
                              <th className="px-3 py-2 border-b border-dark-800">Column Name</th>
                              <th className="px-3 py-2 border-b border-dark-800">Type</th>
                              <th className="px-3 py-2 border-b border-dark-800">Nullable</th>
                              <th className="px-3 py-2 border-b border-dark-800">Key</th>
                              <th className="px-3 py-2 border-b border-dark-800">Default</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-dark-850 text-dark-200">
                            {table.columns.map((col) => (
                              <tr key={col.name} className="hover:bg-dark-850/40">
                                <td className="px-3 py-2 font-mono font-medium text-white flex items-center space-x-1">
                                  {col.key === 'PRI' && <Key size={10} className="text-amber-500 shrink-0" />}
                                  <span>{col.name}</span>
                                </td>
                                <td className="px-3 py-2 font-mono text-dark-400">{col.type}</td>
                                <td className="px-3 py-2">{col.nullable === 'YES' ? 'YES' : 'NO'}</td>
                                <td className="px-3 py-2 font-semibold font-mono text-indigo-400">{col.key || '-'}</td>
                                <td className="px-3 py-2 font-mono text-dark-400">{col.default === null ? 'NULL' : col.default}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Indexes */}
                    {table.indexes?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Indexes</h4>
                        <div className="flex flex-wrap gap-2">
                          {table.indexes.map((idx, index) => (
                            <span 
                              key={`${idx.name}-${index}`} 
                              className="rounded border border-dark-800 bg-dark-900/60 px-2.5 py-1 text-xs font-mono text-dark-300"
                            >
                              <span className="font-semibold text-indigo-400">{idx.name}</span> ({idx.column})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
