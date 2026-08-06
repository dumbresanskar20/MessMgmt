import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { 
  Plus, Edit, Trash2, Copy, Search, Eye, Filter, RefreshCw, 
  ChevronLeft, ChevronRight, Download, MoreHorizontal, Check, X,
  Trash, EyeOff, Columns, SlidersHorizontal, ArrowUpDown
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import StudentDetails from './StudentDetails';

export default function CrudView() {
  const { model } = useParams();
  const queryClient = useQueryClient();
  
  // Navigation / Search state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filters, setFilters] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Modals / Drawer State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit' | 'duplicate'
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [activeStudentId, setActiveStudentId] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState({});

  // Reset pagination on model change
  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
    setSearch('');
    setFilters({});
  }, [model]);

  // 1. Fetch database tables definition to retrieve columns of current model
  const { data: dbData, isLoading: isSchemaLoading } = useQuery({
    queryKey: ['devDatabaseTables'],
    queryFn: async () => {
      const res = await axios.get('/api/developer/database/tables');
      return res.data;
    },
  });

  const tableMeta = dbData?.tables?.find(t => t.name.toLowerCase() === model.toLowerCase());
  const columns = tableMeta?.columns || [];

  // Sync visible columns when table metadata loads
  useEffect(() => {
    if (columns.length > 0) {
      const cols = {};
      columns.forEach(c => {
        cols[c.name] = true;
      });
      setVisibleColumns(cols);
    }
  }, [columns]);

  // 2. Fetch page records
  const { data: recordsData, isLoading: isRecordsLoading, refetch } = useQuery({
    queryKey: ['devCrudList', model, page, limit, search, sortBy, sortOrder, filters],
    queryFn: async () => {
      const res = await axios.get(`/api/developer/crud/${model}`, {
        params: {
          page,
          limit,
          sortBy,
          sortOrder,
          search,
          filters: JSON.stringify(filters),
        }
      });
      return res.data;
    },
  });

  const records = recordsData?.records || [];
  const pagination = recordsData?.pagination || { total: 0, pages: 1 };

  // 3. React Hook Form Setup
  const { register, handleSubmit, reset, setValue } = useForm();

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setSelectedRecord(null);
    reset({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record, mode = 'edit') => {
    setModalMode(mode);
    setSelectedRecord(record);
    
    // Bind current row values to form
    const formVals = {};
    columns.forEach(col => {
      if (col.name === 'password_hash') {
        formVals.password_hash = ''; // Clear password field for security
      } else {
        // Format dates correctly for <input type="datetime-local">
        if (record[col.name] && col.type.toLowerCase().includes('datetime')) {
          formVals[col.name] = new Date(record[col.name]).toISOString().slice(0, 16);
        } else {
          formVals[col.name] = record[col.name];
        }
      }
    });
    
    reset(formVals);
    setIsModalOpen(true);
  };

  // 4. CRUD Mutations
  const createMutation = useMutation({
    mutationFn: (data) => axios.post(`/api/developer/crud/${model}`, data),
    onSuccess: () => {
      toast.success('Record created successfully');
      queryClient.invalidateQueries(['devCrudList', model]);
      setIsModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to create record');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/developer/crud/${model}/${id}`, data),
    onSuccess: () => {
      toast.success('Record updated successfully');
      queryClient.invalidateQueries(['devCrudList', model]);
      setIsModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update record');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => axios.delete(`/api/developer/crud/${model}/${id}`),
    onSuccess: () => {
      toast.success('Record deleted successfully');
      queryClient.invalidateQueries(['devCrudList', model]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete record');
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => axios.post(`/api/developer/crud/${model}/bulk-delete`, { ids }),
    onSuccess: (res) => {
      toast.success(`${res.data.count} records bulk-deleted`);
      setSelectedIds([]);
      queryClient.invalidateQueries(['devCrudList', model]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
    }
  });

  // Handle Form Submit
  const onFormSubmit = (formData) => {
    // Clean up empty fields
    const payload = { ...formData };
    Object.keys(payload).forEach(k => {
      if (payload[k] === '') delete payload[k];
      
      // Parse checkboxes/toggles as booleans
      const colMeta = columns.find(c => c.name === k);
      if (colMeta?.type.toLowerCase().includes('tinyint') || colMeta?.type.toLowerCase() === 'boolean') {
        payload[k] = payload[k] === 'true' || payload[k] === true;
      }
    });

    if (modalMode === 'create' || modalMode === 'duplicate') {
      createMutation.mutate(payload);
    } else {
      createMutation.mutate(payload); // Actually update is PUT!
    }
  };

  const handleActualFormSubmit = handleSubmit((data) => {
    const payload = { ...data };
    if (modalMode === 'edit') {
      // If password hash is empty, don't update it
      if (payload.password_hash === '') {
        delete payload.password_hash;
      }
      updateMutation.mutate({ id: selectedRecord.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  });

  const handleDelete = (id) => {
    if (window.confirm('Are you absolutely sure you want to delete this record?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Delete ${selectedIds.length} selected records?`)) {
      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  // Toggle selection checkbox
  const toggleSelectRow = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === records.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map(r => r.id));
    }
  };

  // Export Table Data to CSV
  const handleExportCSV = async () => {
    try {
      const response = await axios.get(`/api/developer/crud/${model}?limit=1000`);
      const allRecords = response.data.records;
      
      if (allRecords.length === 0) {
        toast.error('No records available to export.');
        return;
      }

      const headers = columns.map(c => c.name).join(',');
      const rows = allRecords.map(rec => {
        return columns.map(col => {
          let val = rec[col.name];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',');
      });

      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${model}_export_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV Export download started');
    } catch (error) {
      toast.error('CSV Export failed');
    }
  };

  if (isSchemaLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex space-x-6 relative h-full">
      
      {/* Main Table Container */}
      <div className="flex-1 space-y-4 overflow-x-auto min-w-0">
        
        {/* Table Title and Actions Header */}
        <div className="flex flex-col justify-between space-y-4 sm:flex-row sm:items-center sm:space-y-0">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white capitalize">
              {model.replace(/([A-Z])/g, ' $1').trim()} Management
            </h2>
            <p className="text-sm text-dark-400">View structure schemas, insert values, perform actions, and bulk update records.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => refetch()}
              className="rounded-lg p-2 bg-dark-900 border border-dark-800 text-dark-400 hover:text-white"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 rounded-lg border border-dark-800 bg-dark-900 px-3.5 py-2 text-xs font-semibold text-dark-200 hover:text-white cursor-pointer"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-md cursor-pointer transition duration-150"
            >
              <Plus size={14} />
              <span>Create Record</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 bg-dark-900/40 p-4 rounded-xl border border-dark-850">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3 text-dark-500" />
            <input
              type="text"
              placeholder="Search table values..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-dark-800 bg-dark-950/60 py-2 pl-10 pr-4 text-xs text-white placeholder-dark-600 outline-none focus:border-indigo-500"
            />
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => {
                const colToHide = Object.keys(visibleColumns)[0];
                if (colToHide) {
                  setVisibleColumns({ ...visibleColumns, [colToHide]: !visibleColumns[colToHide] });
                }
              }}
              className="flex items-center space-x-1.5 rounded-lg border border-dark-800 bg-dark-950/60 px-3 py-2 text-xs text-dark-300 hover:text-white"
            >
              <Columns size={14} />
              <span>Toggle Columns</span>
            </button>
          </div>
        </div>

        {/* Bulk Action Controls */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between bg-indigo-600/10 border border-indigo-500/20 px-4 py-3 rounded-lg text-xs text-indigo-400">
            <div className="flex items-center space-x-2">
              <span className="font-semibold">{selectedIds.length} records selected</span>
            </div>
            <button
              onClick={handleBulkDelete}
              className="flex items-center space-x-1 px-3 py-1.5 rounded bg-red-950/30 border border-red-500/20 text-red-400 hover:bg-red-900/20 cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Bulk Delete Selected</span>
            </button>
          </div>
        )}

        {/* Records Table View */}
        <div className="glass-panel border border-dark-850 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs border-collapse">
              <thead className="bg-[#0d0d11]/80 text-dark-300 border-b border-dark-800 font-semibold">
                <tr>
                  {/* Select All Checkbox */}
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      checked={records.length > 0 && selectedIds.length === records.length}
                      onChange={toggleSelectAll}
                      className="rounded border-dark-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  {/* Model Columns Headers */}
                  {columns
                    .filter(c => visibleColumns[c.name])
                    .map((col) => (
                      <th 
                        key={col.name} 
                        onClick={() => {
                          if (sortBy === col.name) {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy(col.name);
                            setSortOrder('desc');
                          }
                        }}
                        className="p-4 cursor-pointer hover:bg-dark-800/40 select-none"
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className="capitalize">{col.name.replace(/_/g, ' ')}</span>
                          <ArrowUpDown size={12} className="text-dark-500" />
                        </div>
                      </th>
                    ))}
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>

              {isRecordsLoading ? (
                <tbody>
                  <tr>
                    <td colSpan={columns.length + 2} className="p-12 text-center text-dark-400">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mx-auto mb-2"></div>
                      Querying records...
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody className="divide-y divide-dark-850 text-dark-200">
                  {records.length > 0 ? (
                    records.map((record) => (
                      <tr key={record.id} className="hover:bg-dark-800/20 transition">
                        {/* Checkbox */}
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(record.id)}
                            onChange={() => toggleSelectRow(record.id)}
                            className="rounded border-dark-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        {/* Values */}
                        {columns
                          .filter(c => visibleColumns[c.name])
                          .map((col) => {
                            let value = record[col.name];
                            
                            // Image thumbnails rendering for MenuItem images
                            if (col.name === 'image_url') {
                              return (
                                <td key={col.name} className="p-4 whitespace-nowrap">
                                  <img 
                                    src={value || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=40&q=40"} 
                                    alt="item" 
                                    className="h-8 w-8 rounded-md object-cover border border-dark-800"
                                    onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=40&q=40" }}
                                  />
                                </td>
                              );
                            }

                            // Passwords rendering
                            if (col.name === 'password_hash') {
                              return <td key={col.name} className="p-4 font-mono text-dark-500">••••••••</td>;
                            }

                            // Booleans rendering
                            if (typeof value === 'boolean') {
                              return (
                                <td key={col.name} className="p-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${
                                    value 
                                      ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' 
                                      : 'border-red-500/20 bg-red-500/5 text-red-400'
                                  }`}>
                                    {value ? 'True' : 'False'}
                                  </span>
                                </td>
                              );
                            }

                            // Dates rendering
                            if (col.type.toLowerCase().includes('datetime') && value) {
                              value = new Date(value).toLocaleString();
                            }

                            return (
                              <td key={col.name} className="p-4 max-w-[200px] truncate font-mono text-dark-300">
                                {value === null || value === undefined ? <span className="text-dark-600">NULL</span> : String(value)}
                              </td>
                            );
                          })}
                        {/* Actions */}
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center space-x-1.5">
                            {model === 'Student' && (
                              <button
                                onClick={() => setActiveStudentId(record.id)}
                                className="rounded p-1.5 text-dark-400 hover:bg-dark-800 hover:text-white"
                                title="View Student Profile Drawer"
                              >
                                <Eye size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenEditModal(record, 'edit')}
                              className="rounded p-1.5 text-indigo-400 hover:bg-indigo-950/20"
                              title="Edit Record"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(record, 'duplicate')}
                              className="rounded p-1.5 text-amber-400 hover:bg-amber-950/20"
                              title="Duplicate Record"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(record.id)}
                              className="rounded p-1.5 text-red-400 hover:bg-red-950/20"
                              title="Delete Record"
                            >
                              <Trash size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columns.length + 2} className="p-8 text-center text-dark-500">
                        No records stored in this table matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              )}
            </table>
          </div>

          {/* Table Footer - Pagination */}
          <div className="flex items-center justify-between border-t border-dark-800 bg-[#0d0d11]/45 p-4 text-xs">
            <span className="text-dark-400">
              Showing page <span className="font-semibold text-white">{page}</span> of <span className="font-semibold text-white">{pagination.pages}</span> ({pagination.total} records total)
            </span>

            <div className="flex space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded border border-dark-800 bg-dark-900 px-3 py-1.5 font-medium text-dark-200 hover:text-white disabled:opacity-50 flex items-center space-x-1 cursor-pointer"
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage(page + 1)}
                className="rounded border border-dark-800 bg-dark-900 px-3 py-1.5 font-medium text-dark-200 hover:text-white disabled:opacity-50 flex items-center space-x-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Slide-over Details Drawer (Conditional on student details view) */}
      {activeStudentId && (
        <>
          <div 
            onClick={() => setActiveStudentId(null)}
            className="fixed inset-0 z-40 bg-black/60"
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md shadow-2xl transition duration-200">
            <StudentDetails 
              studentId={activeStudentId} 
              onClose={() => setActiveStudentId(null)} 
            />
          </div>
        </>
      )}

      {/* CRUD Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-lg rounded-xl border border-dark-800 bg-dark-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-dark-800 pb-3">
              <h3 className="text-sm font-bold text-white capitalize">
                {modalMode === 'edit' ? `Edit ${model} Record` : modalMode === 'duplicate' ? `Duplicate ${model} Record` : `Create ${model} Record`}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="rounded text-dark-400 hover:bg-dark-800 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleActualFormSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs">
              
              {columns
                .filter(col => col.name !== 'id' && col.name !== 'created_at' && col.name !== 'updated_at')
                .map((col) => {
                  
                  // Check if column is password
                  if (col.name === 'password_hash') {
                    return (
                      <div key={col.name}>
                        <label className="block text-dark-300 mb-1 capitalize font-medium">{col.name.replace(/_/g, ' ')}</label>
                        <input
                          type="password"
                          placeholder={modalMode === 'edit' ? "Leave empty to keep current password" : "Enter password"}
                          className="w-full rounded-lg border border-dark-800 bg-dark-950/60 p-2.5 text-white outline-none focus:border-indigo-500"
                          {...register(col.name, { required: modalMode === 'create' })}
                        />
                      </div>
                    );
                  }

                  // Check if field is enum
                  const enumMatch = col.type.toLowerCase().match(/enum\((.*)\)/);
                  if (enumMatch) {
                    const enumOptions = enumMatch[1].split(',').map(v => v.replace(/'/g, '').trim());
                    return (
                      <div key={col.name}>
                        <label className="block text-dark-300 mb-1 capitalize font-medium">{col.name.replace(/_/g, ' ')}</label>
                        <select
                          className="w-full rounded-lg border border-dark-800 bg-dark-950/60 p-2.5 text-white outline-none focus:border-indigo-500 cursor-pointer"
                          {...register(col.name)}
                        >
                          {enumOptions.map(opt => (
                            <option key={opt} value={opt} className="bg-dark-900">{opt}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  // Check if field is boolean
                  if (col.type.toLowerCase().includes('tinyint') || col.type.toLowerCase() === 'boolean') {
                    return (
                      <div key={col.name} className="flex items-center space-x-2.5 py-1">
                        <input
                          type="checkbox"
                          id={col.name}
                          className="rounded border-dark-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                          {...register(col.name)}
                        />
                        <label htmlFor={col.name} className="text-dark-300 capitalize font-medium cursor-pointer">
                          {col.name.replace(/_/g, ' ')} (True/False)
                        </label>
                      </div>
                    );
                  }

                  // Check if field is numeric
                  const isNumeric = col.type.toLowerCase().includes('int') || col.type.toLowerCase().includes('decimal');
                  
                  // Check if field is date/time
                  const isDateTime = col.type.toLowerCase().includes('datetime') || col.type.toLowerCase().includes('timestamp');

                  return (
                    <div key={col.name}>
                      <label className="block text-dark-300 mb-1 capitalize font-medium">{col.name.replace(/_/g, ' ')}</label>
                      <input
                        type={isNumeric ? 'number' : isDateTime ? 'datetime-local' : 'text'}
                        step={col.type.toLowerCase().includes('decimal') ? '0.01' : '1'}
                        placeholder={`Enter ${col.name}`}
                        className="w-full rounded-lg border border-dark-800 bg-dark-950/60 p-2.5 text-white outline-none focus:border-indigo-500"
                        {...register(col.name, { 
                          required: col.nullable === 'NO' && col.name !== 'password_hash',
                          valueAsNumber: isNumeric,
                        })}
                      />
                    </div>
                  );
                })}

              <div className="flex justify-end space-x-3 pt-3 border-t border-dark-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-dark-800 bg-dark-950/20 px-4 py-2 font-semibold text-dark-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 shadow-md cursor-pointer"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
