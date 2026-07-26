import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Check, Image as ImageIcon, Upload, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function MenuManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMeal, setFilterMeal] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [mealType, setMealType] = useState('breakfast');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchMenuItems();
  }, [filterMeal]);

  const showToast = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      let url = '/menu/items';
      if (filterMeal) url += `?meal_type=${filterMeal}`;
      const res = await api.get(url);
      if (res.data.success) {
        setItems(res.data.items);
      }
    } catch (err) {
      showToast('Error loading menu items.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setPrice('');
    setMealType('breakfast');
    setImageUrl('');
    setImageFile(null);
    setImagePreview('');
    setDescription('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setName(item.name);
    setPrice(item.price.toString());
    setMealType(item.meal_type);
    setImageUrl(item.image_url || '');
    setImageFile(null);
    setImagePreview(item.image_url || '');
    setDescription(item.description || '');
    setIsActive(item.is_active);
    setIsModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Image file exceeds the 2MB size limit.', 'error');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!name.trim() || !price || isNaN(Number(price))) {
      showToast('Couldn\'t save — please check the item name and price field.', 'error');
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('price', Number(price));
      formData.append('meal_type', mealType);
      formData.append('description', description);
      formData.append('is_active', isActive);

      if (imageFile) {
        formData.append('image', imageFile);
      } else if (imageUrl) {
        formData.append('image_url', imageUrl);
      }

      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      };

      if (editingItem) {
        await api.put(`/menu/items/${editingItem._id}`, formData, config);
        showToast(`Item '${name}' saved successfully to Cloudinary!`);
      } else {
        await api.post('/menu/items', formData, config);
        showToast(`New item '${name}' uploaded & added to menu!`);
      }

      setIsModalOpen(false);
      fetchMenuItems();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Image upload failed — please try a smaller file or check your connection.';
      showToast(errMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item) => {
    try {
      const updatedStatus = !item.is_active;
      await api.put(`/menu/items/${item._id}`, { is_active: updatedStatus });
      setItems((prev) =>
        prev.map((i) => (i._id === item._id ? { ...i, is_active: updatedStatus } : i))
      );
      showToast(`Item '${item.name}' set to ${updatedStatus ? 'Active' : 'Inactive'}.`);
    } catch (err) {
      showToast('Error updating item status.', 'error');
    }
  };

  const handleDeleteItem = async (id, itemName) => {
    if (!window.confirm(`Are you sure you want to delete '${itemName}'? This will also remove the image from Cloudinary.`)) return;

    try {
      await api.delete(`/menu/items/${id}`);
      showToast(`Item '${itemName}' and associated Cloudinary image deleted.`);
      fetchMenuItems();
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
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Menu Management</h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Add food items, upload Cloudinary images, update prices, and toggle active availability
          </p>
        </div>

        {/* Prominent Add Item Button */}
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm px-6 py-3 rounded-2xl shadow-md transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Menu Item</span>
        </button>
      </div>

      {/* Meal Filter Tabs */}
      <div className="flex gap-2 bg-slate-100 p-2 rounded-2xl border border-slate-200">
        {['', 'breakfast', 'lunch', 'snacks', 'dinner'].map((m) => (
          <button
            key={m}
            onClick={() => setFilterMeal(m)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
              filterMeal === m ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
          >
            {m || 'All Categories'}
          </button>
        ))}
      </div>

      {/* Menu Table / Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 font-bold">Loading menu catalog...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <p className="font-bold text-slate-600">No items found for this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div
              key={item._id}
              className={`bg-white rounded-2xl border p-4 shadow-sm flex flex-col justify-between transition-all ${
                item.is_active ? 'border-slate-200' : 'border-slate-200 bg-slate-50/70 opacity-70'
              }`}
            >
              <div>
                <div className="relative h-40 rounded-xl overflow-hidden mb-3 bg-slate-100">
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  <span className="absolute top-2.5 left-2.5 bg-slate-900/80 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                    {item.meal_type}
                  </span>
                  {item.cloudinary_public_id && (
                    <span className="absolute bottom-2 right-2 bg-emerald-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow">
                      Cloudinary Hosted
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-base text-slate-900">{item.name}</h3>
                  <span className="font-black text-emerald-700 text-lg">₹{item.price}</span>
                </div>

                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
              </div>

              {/* Clear Active Toggle Switch & Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                
                {/* On/Off Toggle Switch */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(item)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      item.is_active ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        item.is_active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className={`text-xs font-bold ${item.is_active ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item._id, item.name)}
                    className="p-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">
                {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Masala Dosa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="50"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Meal Type</label>
                  <select
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium capitalize"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="snacks">Snacks</option>
                    <option value="dinner">Dinner</option>
                  </select>
                </div>
              </div>

              {/* Cloudinary Image Upload Section */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Food Image (Cloudinary)</label>
                
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>{imageFile ? imageFile.name : 'Upload Image File (Max 2MB)'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="relative text-center my-1">
                  <span className="bg-white px-2 text-[10px] text-slate-400 font-bold uppercase">Or supply Image URL</span>
                </div>

                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    if (!imageFile) setImagePreview(e.target.value);
                  }}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium text-xs"
                />

                {imagePreview && (
                  <div className="mt-2 h-24 rounded-xl overflow-hidden border border-slate-200 relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[9px] font-bold px-2 py-0.5 rounded">
                      Preview
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of the item"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="activeCheck" className="text-xs font-bold text-slate-700">
                  Item is active and available for ordering
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                {saving ? 'Uploading to Cloudinary...' : 'Save Menu Item'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
