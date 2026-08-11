import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Trash2, Edit2, Archive, AlertTriangle, 
  User, History, Sparkles, Scale, RefreshCw, Check, X, AlertCircle
} from 'lucide-react';
import api from '../services/api';

const PREDEFINED_CATEGORIES = [
  { id: 'vegetables', name: 'Vegetables' },
  { id: 'grains_pulses', name: 'Grains/Flours/Pulses' },
  { id: 'dairy_proteins', name: 'Dairy & Proteins' },
  { id: 'oil_spices', name: 'Oil/Spices/Condiments' },
  { id: 'snack_essentials', name: 'Snack/Fried Item Essentials' },
  { id: 'beverages', name: 'Beverages' },
  { id: 'other', name: 'Other' }
];

export default function InventoryManagement() {
  // Data States
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    totalItems: 0,
    activeItems: 0,
    outOfStockCount: 0,
    lowStockCount: 0
  });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);

  // Search & Pagination States
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState('all'); // 'all' | 'active' | 'inactive'
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(8);

  // Modal Open/Close States
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);

  // Modal Form Inputs
  const [editingItem, setEditingItem] = useState(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [category, setCategory] = useState('vegetables');
  const [quantityInStock, setQuantityInStock] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [collapsedCategories, setCollapsedCategories] = useState({});

  const [restockingItem, setRestockingItem] = useState(null);
  const [restockQuantity, setRestockQuantity] = useState('');

  const [loggingItem, setLoggingItem] = useState(null);
  const [activeLogs, setActiveLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // Get all unique categories in items, preserving predefined ones first
  const getCategoriesList = () => {
    const list = [...PREDEFINED_CATEGORIES];
    items.forEach(item => {
      const catId = item.category || 'other';
      if (!list.some(c => c.id === catId)) {
        const name = catId
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        list.push({ id: catId, name });
      }
    });
    return list;
  };

  // Group items by category
  const getGroupedItems = () => {
    const grouped = {};
    PREDEFINED_CATEGORIES.forEach(cat => {
      grouped[cat.id] = [];
    });

    items.forEach(item => {
      const cat = item.category || 'other';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(item);
    });

    return grouped;
  };

  // Hooks
  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [search, filterActive, page]);

  const showToast = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // 1. Fetch Dashboard Stats & Summary
  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await api.get('/inventory/summary');
      if (res.data.success) {
        setStats(res.data.stats);
        setLowStockItems(res.data.lowStockItems || []);
        setRecentLogs(res.data.recentLogs || []);
      }
    } catch (err) {
      console.error('Error fetching inventory summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  // 2. Fetch Paginated & Searchable Items (Fetched with limit=1000 for category grouping)
  const fetchItems = async () => {
    setLoadingItems(true);
    try {
      let url = `/inventory?limit=1000`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      if (filterActive !== 'all') url += `&is_active=${filterActive === 'active'}`;
      
      const res = await api.get(url);
      if (res.data.success) {
        setItems(res.data.items || []);
        setPages(1);
      }
    } catch (err) {
      console.error('Error loading inventory items:', err);
      showToast('Error loading inventory catalog.', 'error');
    } finally {
      setLoadingItems(false);
    }
  };

  // 3. Trigger Log Modal & Load Logs
  const openLogsModal = async (item) => {
    setLoggingItem(item);
    setIsLogsOpen(true);
    setLoadingLogs(true);
    try {
      const res = await api.get(`/inventory/${item.id}/logs`);
      if (res.data.success) {
        setActiveLogs(res.data.logs);
      }
    } catch (err) {
      console.error('Error loading logs:', err);
      showToast('Could not fetch activity logs.', 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  // 4. Trigger Add Modal
  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setUnit('kg');
    setCategory('vegetables');
    setQuantityInStock('0');
    setLowStockThreshold('1');
    setIsActive(true);
    setIsAddEditOpen(true);
  };

  // 5. Trigger Edit Modal
  const openEditModal = (item) => {
    setEditingItem(item);
    setName(item.name);
    setUnit(item.unit);
    setCategory(item.category || 'other');
    setQuantityInStock(item.quantity_in_stock.toString());
    setLowStockThreshold(item.low_stock_threshold.toString());
    setIsActive(item.is_active);
    setIsAddEditOpen(true);
  };

  // 6. Trigger Restock Modal
  const openRestockModal = (item) => {
    setRestockingItem(item);
    setRestockQuantity('');
    setIsRestockOpen(true);
  };

  // 7. Save Item (Create or Update)
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!name.trim() || quantityInStock === '' || lowStockThreshold === '' || !category) {
      showToast('Please check and fill out all fields.', 'error');
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      unit,
      quantity_in_stock: parseFloat(quantityInStock),
      low_stock_threshold: parseFloat(lowStockThreshold),
      is_active: isActive,
      category,
    };

    try {
      if (editingItem) {
        await api.put(`/inventory/${editingItem.id}`, payload);
        showToast(`Item '${name}' updated successfully!`);
      } else {
        await api.post('/inventory', payload);
        showToast(`New item '${name}' registered in inventory!`);
      }
      setIsAddEditOpen(false);
      fetchItems();
      fetchSummary();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to save inventory item.';
      showToast(errMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // 8. Restock Item (Increment Stock)
  const handleRestock = async (e) => {
    e.preventDefault();
    const qty = parseFloat(restockQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast('Please specify a positive number.', 'error');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/inventory/${restockingItem.id}/restock`, { quantity: qty });
      showToast(`Added ${qty} ${restockingItem.unit} to '${restockingItem.name}' stock.`);
      setIsRestockOpen(false);
      fetchItems();
      fetchSummary();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to restock item.';
      showToast(errMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // 9. Hard Delete Item from Database
  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to permanently delete '${item.name}'? This will remove its stock logs and recipe mappings.`)) return;

    try {
      await api.delete(`/inventory/${item.id}`);
      showToast(`Item '${item.name}' deleted successfully.`);
      fetchItems();
      fetchSummary();
    } catch (err) {
      showToast('Error deleting item.', 'error');
    }
  };

  return (
    <div className="p-6 space-y-6">
      
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl border font-bold text-sm flex items-center gap-2.5 animate-in slide-in-from-top-3 ${
            notification.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {notification.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Check className="w-5 h-5" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Total Inventory</h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Maintain grocery items, map ingredient serving weights, and view auto-depletion records
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm px-6 py-3 rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>Register New Item</span>
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 text-2xl font-bold">
            📦
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Items</p>
            <h3 className="text-2xl font-black text-slate-900">{stats.totalItems}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-emerald-600 text-2xl font-bold border border-emerald-100">
            🌱
          </div>
          <div>
            <p className="text-emerald-600/70 text-[10px] font-bold uppercase tracking-wider">Active Stock</p>
            <h3 className="text-2xl font-black text-emerald-800">{stats.activeItems}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold ${stats.outOfStockCount > 0 ? 'bg-red-50 text-red-600 border border-red-100 animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
            🚨
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Out of Stock</p>
            <h3 className={`text-2xl font-black ${stats.outOfStockCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{stats.outOfStockCount}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold ${stats.lowStockCount > 0 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-100 text-slate-400'}`}>
            ⚠️
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Low Stock Level</p>
            <h3 className={`text-2xl font-black ${stats.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{stats.lowStockCount}</h3>
          </div>
        </div>
      </div>

      {/* Grid: Low Stock Alerts & Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Low Stock Alerts (Left 1/3) */}
        <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-96">
          <div className="space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">Low Stock Alerts</h3>
              </div>
              <span className="bg-amber-100 text-amber-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                {lowStockItems.length + stats.outOfStockCount} items
              </span>
            </div>

            {loadingSummary ? (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">Analyzing stock levels...</div>
            ) : (lowStockItems.length === 0 && stats.outOfStockCount === 0) ? (
              <div className="text-center py-14">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full flex items-center justify-center mx-auto text-lg mb-3">✓</div>
                <p className="text-xs font-bold text-slate-700">All stocks are healthy!</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Ingredients are well above thresholds</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {items.filter(i => i.is_active && (Number(i.quantity_in_stock) <= Number(i.low_stock_threshold))).map((item) => {
                  const qty = Number(item.quantity_in_stock);
                  const isDepleted = qty <= 0;
                  return (
                    <div 
                      key={item.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        isDepleted ? 'bg-red-50/55 border-red-200' : 'bg-amber-50/40 border-amber-200/80'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold text-slate-800 truncate">{item.name}</p>
                        <p className="text-[9px] font-semibold text-slate-400">
                          Threshold: {item.low_stock_threshold} {item.unit}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <span className={`text-xs font-black ${isDepleted ? 'text-red-700' : 'text-amber-700'}`}>
                          {qty} {item.unit}
                        </span>
                        <button
                          onClick={() => openRestockModal(item)}
                          className="bg-white hover:bg-slate-50 border text-[10px] font-extrabold px-2.5 py-1 rounded-lg text-slate-700 transition shadow-sm cursor-pointer"
                        >
                          Restock
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="pt-2 text-[10px] text-slate-400 font-semibold text-center border-t border-slate-100">
            *Depleted items will disable linked student meals
          </div>
        </div>

        {/* Recent Inventory Logs (Right 2/3) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-96 flex flex-col justify-between">
          <div className="space-y-4 overflow-y-auto flex-1">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">Recent Activity Log</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Live Feeds</span>
            </div>

            {loadingSummary ? (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">Fetching history...</div>
            ) : recentLogs.length === 0 ? (
              <div className="text-center py-14 text-xs text-slate-400 font-semibold">
                No inventory logs found. Restock items to start history.
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {recentLogs.map((log) => {
                  const isRestock = log.action_type === 'restock';
                  return (
                    <div key={log.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition text-xs">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${isRestock ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <div>
                          <p className="font-bold text-slate-800">
                            {isRestock ? 'Restocked' : 'Deducted'} {log.inventory_item?.name}
                          </p>
                          <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-3">
                        <span className={`font-extrabold ${isRestock ? 'text-emerald-700' : 'text-red-700'}`}>
                          {isRestock ? '+' : ''}{log.quantity_changed} {log.inventory_item?.unit}
                        </span>
                        
                        {log.admin_user && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                            👤 {log.admin_user.username}
                          </span>
                        )}

                        {log.order && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 font-extrabold px-2 py-0.5 rounded-md">
                            🎫 {log.order.token_number || `Order #${log.order.id}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Main Stock Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        
        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ingredient name or unique ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const collapsed = {};
                  getCategoriesList().forEach(c => {
                    collapsed[c.id] = true;
                  });
                  setCollapsedCategories(collapsed);
                }}
                className="px-3.5 py-1.5 rounded-xl border text-[11px] font-extrabold text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm cursor-pointer"
              >
                Collapse All
              </button>
              <button
                onClick={() => {
                  setCollapsedCategories({});
                }}
                className="px-3.5 py-1.5 rounded-xl border text-[11px] font-extrabold text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm cursor-pointer"
              >
                Expand All
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 font-semibold">
              {[
                { id: 'all', label: 'All Items' },
                { id: 'active', label: 'Active Only' },
                { id: 'inactive', label: 'Inactive' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setFilterActive(opt.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                    filterActive === opt.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stock Catalog Grouped by Category */}
        {loadingItems ? (
          <div className="text-center py-16 text-slate-400 font-bold">Retrieving inventory items...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 border rounded-xl border-dashed border-slate-200">
            <p className="font-bold text-slate-600">No inventory items found.</p>
            <p className="text-xs text-slate-400 mt-1">Register new raw grocery materials to populate catalog.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(() => {
              const categoriesList = getCategoriesList();
              const groupedItems = getGroupedItems();
              const isSearching = search.trim() !== '';

              return categoriesList.map(cat => {
                const catItems = groupedItems[cat.id] || [];

                // Filter items of this category by active/inactive if not 'all'
                const filteredCatItems = catItems.filter(item => {
                  if (filterActive === 'active') return item.is_active;
                  if (filterActive === 'inactive') return !item.is_active;
                  return true;
                });

                if (isSearching && filteredCatItems.length === 0) {
                  return null;
                }

                const isCollapsed = isSearching ? false : !!collapsedCategories[cat.id];

                return (
                  <div key={cat.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all duration-200">
                    {/* Category Header */}
                    <button
                      onClick={() => {
                        if (!isSearching) {
                          setCollapsedCategories(prev => ({
                            ...prev,
                            [cat.id]: !prev[cat.id]
                          }));
                        }
                      }}
                      className={`w-full flex items-center justify-between p-4 bg-slate-50/70 border-b border-slate-100 text-left font-black transition ${
                        isSearching ? 'cursor-default' : 'hover:bg-slate-100/60 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">
                          {cat.id === 'vegetables' && '🥗'}
                          {cat.id === 'grains_pulses' && '🌾'}
                          {cat.id === 'dairy_proteins' && '🥚'}
                          {cat.id === 'oil_spices' && '🌶️'}
                          {cat.id === 'snack_essentials' && '🍟'}
                          {cat.id === 'beverages' && '🥤'}
                          {cat.id === 'other' && '📦'}
                          {!['vegetables', 'grains_pulses', 'dairy_proteins', 'oil_spices', 'snack_essentials', 'beverages', 'other'].includes(cat.id) && '🏷️'}
                        </span>
                        <span className="text-sm font-black text-slate-800 tracking-tight">{cat.name}</span>
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full">
                          {filteredCatItems.length} {filteredCatItems.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                      {!isSearching && (
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-white px-2 py-1 rounded-lg border border-slate-200">
                          {isCollapsed ? 'Expand' : 'Collapse'}
                        </span>
                      )}
                    </button>

                    {/* Category Body */}
                    {!isCollapsed && (
                      <div className="p-4 bg-white">
                        {filteredCatItems.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                            No active items in this category.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase font-extrabold tracking-wider">
                                  <th className="pb-3 pl-2">ID Code</th>
                                  <th className="pb-3">Name</th>
                                  <th className="pb-3">Stock Level</th>
                                  <th className="pb-3">Unit</th>
                                  <th className="pb-3">Alert Threshold</th>
                                  <th className="pb-3">Status</th>
                                  <th className="pb-3 text-right pr-2">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="text-xs divide-y divide-slate-100 font-medium">
                                {filteredCatItems.map((item) => {
                                  const qty = Number(item.quantity_in_stock);
                                  const isLow = qty <= Number(item.low_stock_threshold);
                                  const isOutOfStock = qty <= 0;

                                  return (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition">
                                      <td className="py-3.5 pl-2 font-mono font-bold text-slate-500">
                                        {item.unique_inventory_id}
                                      </td>
                                      <td className="py-3.5 font-bold text-slate-800">
                                        {item.name}
                                      </td>
                                      <td className="py-3.5">
                                        <span className={`font-black text-sm ${
                                          isOutOfStock ? 'text-red-600' : isLow ? 'text-amber-500' : 'text-slate-800'
                                        }`}>
                                          {qty}
                                        </span>
                                        {isLow && (
                                          <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                            isOutOfStock ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                                          }`}>
                                            {isOutOfStock ? 'Depleted' : 'Low'}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-3.5 text-slate-500 font-semibold">{item.unit}</td>
                                      <td className="py-3.5 text-slate-500">{item.low_stock_threshold} {item.unit}</td>
                                      <td className="py-3.5">
                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                          item.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-400'
                                        }`}>
                                          {item.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                      </td>
                                      <td className="py-3.5 text-right pr-2">
                                        <div className="inline-flex gap-1.5">
                                          <button
                                            onClick={() => openRestockModal(item)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-slate-100 text-slate-700 font-extrabold text-[10px] transition shadow-sm cursor-pointer"
                                          >
                                            <Scale className="w-3.5 h-3.5" />
                                            <span>Restock</span>
                                          </button>
                                          <button
                                            onClick={() => openEditModal(item)}
                                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                                            title="Edit"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => openLogsModal(item)}
                                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                            title="Activity Logs"
                                          >
                                            <History className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}

      </div>

      {/* Add / Edit Inventory Modal */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingItem ? 'Edit Inventory Item' : 'Register Grocery Item'}
              </h3>
              <button onClick={() => setIsAddEditOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ingredient Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cooking Oil, Besan, Potato"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                >
                  {PREDEFINED_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Measurement Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="g">g (Gram)</option>
                    <option value="litre">litre (Litre)</option>
                    <option value="ml">ml (Millilitre)</option>
                    <option value="piece">piece (Piece)</option>
                    <option value="packet">packet (Packet)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Low Stock Alert at</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    min="0"
                    placeholder="2.00"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Current Stock Level ({unit})
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  min="0"
                  placeholder="10.00"
                  value={quantityInStock}
                  onChange={(e) => setQuantityInStock(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="invActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="invActiveCheck" className="text-xs font-bold text-slate-700">
                  Item is active and usable in recipes
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? 'Saving changes...' : 'Save Item'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {isRestockOpen && restockingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xs w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Restock Ingredient</h3>
                <span className="text-[10px] text-slate-400 font-bold block mt-0.5">{restockingItem.name} ({restockingItem.unique_inventory_id})</span>
              </div>
              <button onClick={() => setIsRestockOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity to Add ({restockingItem.unit})
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  min="0.001"
                  placeholder="e.g. 5.5"
                  value={restockQuantity}
                  onChange={(e) => setRestockQuantity(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border text-[11px] text-slate-500 font-semibold space-y-1">
                <div className="flex justify-between">
                  <span>Current Stock:</span>
                  <span>{restockingItem.quantity_in_stock} {restockingItem.unit}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-1 text-slate-900 font-bold">
                  <span>Target Stock:</span>
                  <span>{(parseFloat(restockingItem.quantity_in_stock) + (parseFloat(restockQuantity) || 0)).toFixed(3)} {restockingItem.unit}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? 'Logging stock entry...' : 'Confirm Restock'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Logs Modal (History drawer) */}
      {isLogsOpen && loggingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white h-full w-full max-w-md p-6 flex flex-col justify-between border-l border-slate-200 animate-in slide-in-from-right duration-250">
            <div className="space-y-4 overflow-y-auto flex-1">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Activity Logs</h3>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mt-0.5">
                    {loggingItem.name} ({loggingItem.unique_inventory_id})
                  </span>
                </div>
                <button onClick={() => setIsLogsOpen(false)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingLogs ? (
                <div className="text-center py-20 text-slate-400 font-bold text-xs">Loading ledger entries...</div>
              ) : activeLogs.length === 0 ? (
                <div className="text-center py-20 text-slate-400 text-xs font-semibold">
                  No stock activity logs found for this item.
                </div>
              ) : (
                <div className="space-y-3 pr-1 max-h-[80vh] overflow-y-auto">
                  {activeLogs.map((log) => {
                    const isRestock = log.action_type === 'restock';
                    return (
                      <div key={log.id} className="p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs transition">
                        <div>
                          <p className="font-extrabold text-slate-800">
                            {isRestock ? 'Grocery Restocked' : 'Meal Order Deduction'}
                          </p>
                          <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>

                        <div className="text-right flex flex-col items-end gap-1.5">
                          <span className={`font-black text-sm ${isRestock ? 'text-emerald-700' : 'text-red-600'}`}>
                            {isRestock ? '+' : ''}{log.quantity_changed} {loggingItem.unit}
                          </span>
                          {log.admin_user && (
                            <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              👤 {log.admin_user.username}
                            </span>
                          )}
                          {log.order && (
                            <span className="text-[9px] font-black bg-emerald-50 text-emerald-800 border border-emerald-100 px-1.5 py-0.5 rounded">
                              🎫 Token: {log.order.token_number}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold">Ledger capping: latest 50 entries</span>
              <button
                onClick={() => setIsLogsOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
