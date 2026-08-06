import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import api from '../services/api';
import { 
  Users, ShieldAlert, LogOut, Search, Plus, Edit2, Key, Trash2, 
  UserPlus, X, RefreshCw, ClipboardList, ShieldAlert as AlertIcon, AlertTriangle
} from 'lucide-react';

export default function OwnerDashboard() {
  const { admin, logout } = useAdminAuth();
  const [activeSubTab, setActiveSubTab] = useState('students'); // 'students', 'admins', 'logs'
  
  // Data lists
  const [students, setStudents] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [logs, setLogs] = useState([]);

  // Pagination & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals & Drawers state
  const [drawerOpen, setDrawerOpen] = useState(false); // create/edit drawer
  const [drawerMode, setDrawerMode] = useState('create'); // 'create', 'edit'
  const [editTargetId, setEditTargetId] = useState(null);

  // Form Fields
  const [studentForm, setStudentForm] = useState({ name: '', email: '', roll_no: '', is_verified: false, is_active: true });
  const [adminForm, setAdminForm] = useState({ username: '', email: '', role: 'staff', is_verified: false, is_active: true });

  // Reset Password Modal
  const [tempPasswordModal, setTempPasswordModal] = useState({ open: false, password: '', targetEmail: '' });

  // Permanent Delete confirmation Modal
  const [hardDeleteModal, setHardDeleteModal] = useState({ open: false, type: 'student', id: null, emailOrUsername: '', confirmInput: '' });

  useEffect(() => {
    setPage(1);
    setSearchQuery('');
    fetchData(activeSubTab, 1, '');
  }, [activeSubTab]);

  useEffect(() => {
    fetchData(activeSubTab, page, searchQuery);
  }, [page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchData(activeSubTab, 1, searchQuery);
  };

  const fetchData = async (tab, currentPage = 1, query = '') => {
    setLoading(true);
    setError('');
    try {
      const qParams = `?page=${currentPage}&limit=8&search=${encodeURIComponent(query)}`;
      if (tab === 'students') {
        const res = await api.get(`/owner/students${qParams}`);
        setStudents(res.data.students || []);
        setTotalPages(res.data.pages || 1);
      } else if (tab === 'admins') {
        const res = await api.get(`/owner/admins${qParams}`);
        setAdmins(res.data.admins || []);
        setTotalPages(res.data.pages || 1);
      } else if (tab === 'logs') {
        const res = await api.get(`/owner/audit-logs?page=${currentPage}&limit=12`);
        setLogs(res.data.logs || []);
        setTotalPages(res.data.pages || 1);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch database records.');
    } finally {
      setLoading(false);
    }
  };

  const triggerResetPassword = async (type, id, emailOrUser) => {
    if (!window.confirm(`Are you sure you want to generate a new random password for ${emailOrUser}?`)) return;
    try {
      const res = await api.post(`/owner/${type}s/${id}/reset-password`);
      setTempPasswordModal({
        open: true,
        password: res.data.temporaryPassword,
        targetEmail: emailOrUser
      });
      setSuccess(`Generated password reset successfully.`);
      fetchData(activeSubTab, page, searchQuery);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    }
  };

  const handleSoftDelete = async (type, id, emailOrUser) => {
    if (!window.confirm(`Are you sure you want to SOFT-DELETE (deactivate) ${emailOrUser}? Students will no longer be able to log in.`)) return;
    try {
      await api.delete(`/owner/${type}s/${id}`);
      setSuccess(`Soft-deleted ${emailOrUser} successfully.`);
      fetchData(activeSubTab, page, searchQuery);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to soft delete.');
    }
  };

  const triggerHardDelete = (type, id, emailOrUser) => {
    setHardDeleteModal({
      open: true,
      type,
      id,
      emailOrUsername: emailOrUser,
      confirmInput: ''
    });
  };

  const handleHardDeleteSubmit = async (e) => {
    e.preventDefault();
    if (hardDeleteModal.confirmInput !== 'PERMANENTLY DELETE') {
      alert('Please type "PERMANENTLY DELETE" exactly to proceed.');
      return;
    }

    try {
      const { type, id, emailOrUsername } = hardDeleteModal;
      await api.delete(`/owner/${type}s/${id}/permanent`);
      setSuccess(`Permanently deleted ${emailOrUsername} and references.`);
      setHardDeleteModal({ open: false, type: 'student', id: null, emailOrUsername: '', confirmInput: '' });
      fetchData(activeSubTab, 1, searchQuery);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to permanently delete.');
      setHardDeleteModal({ open: false, type: 'student', id: null, emailOrUsername: '', confirmInput: '' });
    }
  };

  const openCreateDrawer = () => {
    setDrawerMode('create');
    setEditTargetId(null);
    setStudentForm({ name: '', email: '', roll_no: '', is_verified: false, is_active: true });
    setAdminForm({ username: '', email: '', role: 'staff', is_verified: false, is_active: true });
    setDrawerOpen(true);
  };

  const openEditDrawer = (type, record) => {
    setDrawerMode('edit');
    setEditTargetId(record.id);
    if (type === 'student') {
      setStudentForm({
        name: record.name,
        email: record.email,
        roll_no: record.roll_no,
        is_verified: record.is_verified,
        is_active: record.is_active
      });
    } else {
      setAdminForm({
        username: record.username,
        email: record.email,
        role: record.role,
        is_verified: record.is_verified,
        is_active: record.is_active
      });
    }
    setDrawerOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (activeSubTab === 'students') {
        if (drawerMode === 'create') {
          const res = await api.post('/owner/students', studentForm);
          setSuccess('Student created successfully.');
          setTempPasswordModal({
            open: true,
            password: res.data.temporaryPassword,
            targetEmail: res.data.student.email
          });
        } else {
          await api.put(`/owner/students/${editTargetId}`, studentForm);
          setSuccess('Student updated successfully.');
        }
      } else {
        if (drawerMode === 'create') {
          const res = await api.post('/owner/admins', adminForm);
          setSuccess('Admin account created successfully.');
          setTempPasswordModal({
            open: true,
            password: res.data.temporaryPassword,
            targetEmail: res.data.admin.email
          });
        } else {
          await api.put(`/owner/admins/${editTargetId}`, adminForm);
          setSuccess('Admin account updated successfully.');
        }
      }
      setDrawerOpen(false);
      fetchData(activeSubTab, page, searchQuery);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.join(', ') || 'Validation or submission failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      
      {/* Top Dangerous Warning Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-slate-950 text-xs font-black py-2.5 px-4 text-center tracking-wider uppercase flex items-center justify-center gap-2 animate-pulse shadow-md">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Developer Panel — Full Database Write Permissions Enabled. Handle All Operations with Caution.</span>
      </div>

      {/* Main Panel Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center font-black">
            🛠️
          </div>
          <div>
            <h1 className="font-display font-black text-lg text-white leading-tight">Database Management</h1>
            <p className="text-[10px] text-amber-500/80 font-bold uppercase tracking-wider">Mess Management System Audit Console</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-300">Developer Session</p>
            <p className="text-[10px] text-slate-500 font-semibold">{admin?.email}</p>
          </div>

          <button
            onClick={logout}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 hover:text-red-400 rounded-xl text-slate-400 transition-colors flex items-center gap-2 text-xs font-bold cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Exit Console</span>
          </button>
        </div>
      </header>

      {/* Navigation Sub-Tabs */}
      <nav className="bg-slate-900 border-b border-slate-800/80 px-6 py-2 flex items-center justify-between shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab('students')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'students'
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Students Database
          </button>
          
          <button
            onClick={() => setActiveSubTab('admins')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'admins'
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Admin Accounts
          </button>

          <button
            onClick={() => setActiveSubTab('logs')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'logs'
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Owner Action Logs
          </button>
        </div>

        {activeSubTab !== 'logs' && (
          <button
            onClick={openCreateDrawer}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-950/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create {activeSubTab === 'students' ? 'Student' : 'Admin'}</span>
          </button>
        )}
      </nav>

      {/* Main Workspace Body */}
      <main className="flex-1 p-6 overflow-y-auto space-y-6">
        
        {/* Error / Success Notifications */}
        {error && (
          <div className="p-4 bg-red-950/40 border border-red-500/20 text-red-400 text-xs font-medium rounded-2xl flex items-center gap-3 animate-in fade-in">
            <AlertIcon className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-xs font-medium rounded-2xl flex items-center gap-3 animate-in fade-in">
            <ClipboardList className="w-5 h-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Filter bar for lists */}
        {activeSubTab !== 'logs' && (
          <form onSubmit={handleSearchSubmit} className="flex gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder={`Search records by email, ${activeSubTab === 'students' ? 'name, roll number' : 'username'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:ring-1 focus:ring-amber-500 font-medium"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Filter Records
            </button>
          </form>
        )}

        {/* Main Database Tables */}
        {loading && <div className="text-center py-12 text-slate-500 text-xs font-bold animate-pulse">Loading database queries...</div>}

        {!loading && activeSubTab === 'students' && (
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-850 text-slate-400 font-bold">
                    <th className="p-4">ID</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Roll Number</th>
                    <th className="p-4">Verified</th>
                    <th className="p-4">Active</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-500 font-medium">No student records found in database.</td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-950/30 transition-colors">
                        <td className="p-4 font-mono text-slate-500">{student.id}</td>
                        <td className="p-4 font-bold text-white">{student.name}</td>
                        <td className="p-4 font-medium text-slate-300">{student.email}</td>
                        <td className="p-4 font-mono font-bold text-slate-400">{student.roll_no}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${student.is_verified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {student.is_verified ? 'YES' : 'PENDING'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${student.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                            {student.is_active ? 'ACTIVE' : 'DISABLED'}
                          </span>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-1">
                          <button
                            onClick={() => openEditDrawer('student', student)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="Edit Record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => triggerResetPassword('student', student.id, student.email)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-500 rounded-lg transition-colors cursor-pointer"
                            title="Reset Password"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleSoftDelete('student', student.id, student.email)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                            title="Deactivate / Soft Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => triggerHardDelete('student', student.id, student.email)}
                            className="p-1.5 bg-red-950/20 hover:bg-red-950 text-red-500 rounded-lg transition-colors cursor-pointer"
                            title="Permanent GDPR Erase"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && activeSubTab === 'admins' && (
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-850 text-slate-400 font-bold">
                    <th className="p-4">ID</th>
                    <th className="p-4">Username</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Verified</th>
                    <th className="p-4">Active</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {admins.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-500 font-medium">No admin records found.</td>
                    </tr>
                  ) : (
                    admins.map((ad) => (
                      <tr key={ad.id} className="hover:bg-slate-950/30 transition-colors">
                        <td className="p-4 font-mono text-slate-500">{ad.id}</td>
                        <td className="p-4 font-bold text-white">{ad.username}</td>
                        <td className="p-4 font-medium text-slate-300">{ad.email}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                            ad.role === 'owner' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            ad.role === 'super_admin' ? 'bg-red-500/15 text-red-400' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {ad.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${ad.is_verified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {ad.is_verified ? 'YES' : 'PENDING'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${ad.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                            {ad.is_active ? 'ACTIVE' : 'DISABLED'}
                          </span>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-1">
                          <button
                            onClick={() => openEditDrawer('admin', ad)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="Edit Record"
                            disabled={ad.id === admin?.id}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => triggerResetPassword('admin', ad.id, ad.username)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-500 rounded-lg transition-colors cursor-pointer"
                            title="Reset Password"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleSoftDelete('admin', ad.id, ad.username)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                            title="Deactivate / Soft Delete"
                            disabled={ad.id === admin?.id}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => triggerHardDelete('admin', ad.id, ad.username)}
                            className="p-1.5 bg-red-950/20 hover:bg-red-950 text-red-500 rounded-lg transition-colors cursor-pointer"
                            title="Permanent Hard Delete"
                            disabled={ad.id === admin?.id}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && activeSubTab === 'logs' && (
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-850 text-slate-400 font-bold">
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Owner ID</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Table</th>
                    <th className="p-4">Target ID</th>
                    <th className="p-4">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500 font-medium font-sans">No audit log trail records found.</td>
                    </tr>
                  ) : (
                    logs.map((lg) => (
                      <tr key={lg.id} className="hover:bg-slate-950/30 transition-colors">
                        <td className="p-4 text-slate-400">{new Date(lg.timestamp).toLocaleString()}</td>
                        <td className="p-4 text-slate-500">ID: {lg.owner_id}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-md font-bold ${
                            lg.action_type === 'CREATE' ? 'bg-emerald-500/10 text-emerald-400' :
                            lg.action_type === 'UPDATE' ? 'bg-blue-500/10 text-blue-400' :
                            lg.action_type === 'RESET_PASSWORD' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {lg.action_type}
                          </span>
                        </td>
                        <td className="p-4 text-white font-sans">{lg.target_table}</td>
                        <td className="p-4 text-slate-500">ID: {lg.target_id}</td>
                        <td className="p-4 text-slate-300 font-sans max-w-sm truncate">{lg.changes_summary}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="flex justify-between items-center bg-slate-900 border border-slate-800/80 px-6 py-4 rounded-2xl">
            <span className="text-xs text-slate-500 font-bold">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>

      {/* CREATE & EDIT DRAWER PANEL */}
      {drawerOpen && (
        <div className="fixed inset-0 z-55 flex justify-end">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => setDrawerOpen(false)} />
          <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between z-10 shadow-2xl relative">
            <div className="space-y-6 overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-display font-black text-white">{drawerMode === 'create' ? 'Create' : 'Modify'} Database Record</h3>
                  <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Tab target: {activeSubTab.toUpperCase()}</p>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                {activeSubTab === 'students' ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Full Name</label>
                      <input
                        type="text"
                        required
                        value={studentForm.name}
                        onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-amber-500 rounded-xl text-sm outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Email Address</label>
                      <input
                        type="email"
                        required
                        value={studentForm.email}
                        onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-amber-500 rounded-xl text-sm outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Roll Number</label>
                      <input
                        type="text"
                        required
                        value={studentForm.roll_no}
                        onChange={(e) => setStudentForm({ ...studentForm, roll_no: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-amber-500 rounded-xl text-sm outline-none font-medium"
                      />
                    </div>
                    <div className="flex gap-4 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={studentForm.is_verified}
                          onChange={(e) => setStudentForm({ ...studentForm, is_verified: e.target.checked })}
                          className="w-4 h-4 bg-slate-950 border-slate-800 rounded focus:ring-amber-500"
                        />
                        <span className="text-xs font-bold text-slate-300">Verified</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={studentForm.is_active}
                          onChange={(e) => setStudentForm({ ...studentForm, is_active: e.target.checked })}
                          className="w-4 h-4 bg-slate-950 border-slate-800 rounded focus:ring-amber-500"
                        />
                        <span className="text-xs font-bold text-slate-300">Active</span>
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Username</label>
                      <input
                        type="text"
                        required
                        value={adminForm.username}
                        onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-amber-500 rounded-xl text-sm outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Email Address</label>
                      <input
                        type="email"
                        required
                        value={adminForm.email}
                        onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-amber-500 rounded-xl text-sm outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Admin Role</label>
                      <select
                        value={adminForm.role}
                        onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-amber-500 rounded-xl text-sm outline-none font-semibold text-white"
                      >
                        <option value="staff">Staff Account</option>
                        <option value="super_admin">Super Admin Account</option>
                        <option value="owner">System Owner Account</option>
                      </select>
                    </div>
                    <div className="flex gap-4 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={adminForm.is_verified}
                          onChange={(e) => setAdminForm({ ...adminForm, is_verified: e.target.checked })}
                          className="w-4 h-4 bg-slate-950 border-slate-800 rounded focus:ring-amber-500"
                        />
                        <span className="text-xs font-bold text-slate-300">Verified</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={adminForm.is_active}
                          onChange={(e) => setAdminForm({ ...adminForm, is_active: e.target.checked })}
                          className="w-4 h-4 bg-slate-950 border-slate-800 rounded focus:ring-amber-500"
                        />
                        <span className="text-xs font-bold text-slate-300">Active</span>
                      </label>
                    </div>
                  </>
                )}

                <div className="pt-6 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Commit Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* RANDOM PASSWORD DISPLAY MODAL */}
      {tempPasswordModal.open && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 select-none">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs" />
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/20 rounded-3xl p-6 shadow-2xl relative space-y-4">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center rounded-2xl mx-auto">
              <Key className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h4 className="text-lg font-black text-white">Temporary Credentials Generated</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                A random credential token has been generated for: <br />
                <span className="text-amber-500 font-bold font-mono">{tempPasswordModal.targetEmail}</span>
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 text-center font-mono font-black text-lg text-white select-all tracking-wider">
              {tempPasswordModal.password}
            </div>

            <p className="text-[10px] text-slate-500 font-medium leading-relaxed text-center">
              ⚠️ Note: This temporary credential token is presented only once. Make sure to copy it or provide it to the user. They must reset their password on login.
            </p>

            <button
              onClick={() => setTempPasswordModal({ open: false, password: '', targetEmail: '' })}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-colors cursor-pointer"
            >
              Acknowledged
            </button>
          </div>
        </div>
      )}

      {/* PERMANENT GDPR HARD DELETE CONFIRMATION MODAL */}
      {hardDeleteModal.open && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 select-none">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs" />
          <form onSubmit={handleHardDeleteSubmit} className="w-full max-w-md bg-slate-900 border border-red-500/20 rounded-3xl p-6 shadow-2xl relative space-y-4">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center rounded-2xl mx-auto">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>

            <div className="text-center space-y-1.5">
              <h4 className="text-lg font-black text-white text-red-400">Permanently Erase Record?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                This will hard delete the account <span className="font-bold text-slate-200">{hardDeleteModal.emailOrUsername}</span> from the database. 
                All associated order history, checkouts, and references will be permanently pruned (GDPR compliant). This action cannot be reversed!
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Type <span className="text-red-400 font-bold">PERMANENTLY DELETE</span> to confirm</label>
              <input
                type="text"
                required
                value={hardDeleteModal.confirmInput}
                onChange={(e) => setHardDeleteModal({ ...hardDeleteModal, confirmInput: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-red-500 rounded-xl text-xs text-white text-center font-bold outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={hardDeleteModal.confirmInput !== 'PERMANENTLY DELETE'}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:hover:bg-red-600 text-white font-black rounded-xl text-xs transition-colors cursor-pointer"
              >
                Erase Record
              </button>
              <button
                type="button"
                onClick={() => setHardDeleteModal({ open: false, type: 'student', id: null, emailOrUsername: '', confirmInput: '' })}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
