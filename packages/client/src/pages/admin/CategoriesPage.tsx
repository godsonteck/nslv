import React, { useCallback, useEffect, useState } from 'react';
import { PageHeader, DataTable, Button, FormField, TextInput, Modal, showToast, SelectInput, Badge } from '../../components/ui';
import { Plus, Trash2, Edit2, RefreshCw } from 'lucide-react';
import { categoriesApi, type ItemCategory } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { PERMISSIONS } from '@nslv/shared';

type CategoryType = 'RESTAURANT' | 'BAR' | 'POOL' | 'EXPENDITURE' | 'INVENTORY' | 'ROOM_TYPE' | 'OTHER';

export const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission(PERMISSIONS.CATEGORIES_MANAGE);

  const [typeFilter, setTypeFilter] = useState<CategoryType | ''>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', type: 'EXPENDITURE' as CategoryType, description: '', color: '#b18a55', order: 0 });

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const result = await categoriesApi.listAll({
        type: typeFilter || undefined,
        includeInactive: true,
      });
      setCategories(result.data);
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('error', 'Category name is required');
      return;
    }
    try {
      if (editingId) {
        await categoriesApi.update(editingId, formData);
        showToast('success', 'Category updated');
      } else {
        await categoriesApi.create(formData);
        showToast('success', 'Category created');
      }
      setModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', type: 'EXPENDITURE', description: '', color: '#b18a55', order: 0 });
      fetchCategories();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to save category');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this category? This cannot be undone.')) return;
    try {
      await categoriesApi.delete(id);
      showToast('success', 'Category deleted');
      fetchCategories();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to delete category');
    }
  };

  const handleEdit = (category: ItemCategory) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      type: category.type as CategoryType,
      description: category.description || '',
      color: category.color || '#b18a55',
      order: category.order || 0,
    });
    setModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({ name: '', type: 'EXPENDITURE', description: '', color: '#b18a55', order: 0 });
    setModalOpen(true);
  };

  const columns = [
    {
      key: 'name',
      header: 'Category Name',
      render: (row: ItemCategory) => (
        <div>
          <div className="font-semibold text-[#F4F4F2]">{row.name}</div>
          <div className="text-[11px] text-[#A0A5AD]">{row.description || '—'}</div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row: ItemCategory) => <Badge label={row.type} variant="info" />,
    },
    {
      key: 'color',
      header: 'Color',
      render: (row: ItemCategory) => (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border border-[#2B303E]" style={{ backgroundColor: row.color || '#999' }} />
          <span className="text-xs text-[#A0A5AD]">{row.color || '—'}</span>
        </div>
      ),
    },
    {
      key: 'order',
      header: 'Display Order',
      render: (row: ItemCategory) => <span className="text-xs text-[#A0A5AD]">{row.order || 0}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (row: ItemCategory) =>
        canManage ? (
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => handleEdit(row)} className="p-1.5 hover:bg-blue-500/10 rounded text-[#A0A5AD] hover:text-blue-400" title="Edit">
              <Edit2 size={14} />
            </button>
            <button onClick={() => handleDelete(row.id)} className="p-1.5 hover:bg-red-500/10 rounded text-[#A0A5AD] hover:text-red-400" title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Category Management"
        subtitle="Organize and manage system categories"
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => void fetchCategories()} loading={refreshing}>
                <RefreshCw size={14} /> Refresh
              </Button>
              <Button variant="primary" size="sm" onClick={handleOpenCreate}>
                <Plus size={14} /> New Category
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex gap-3 items-center">
        <SelectInput value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as CategoryType | '')}>
          <option value="">All Types</option>
          <option value="RESTAURANT">Restaurant</option>
          <option value="BAR">Bar</option>
          <option value="POOL">Pool</option>
          <option value="EXPENDITURE">Expenditures</option>
          <option value="INVENTORY">Inventory</option>
          <option value="ROOM_TYPE">Room Types</option>
          <option value="OTHER">Other</option>
        </SelectInput>
      </div>

      <DataTable
        columns={columns}
        data={categories}
        loading={loading}
        keyFn={(c) => c.id}
        emptyTitle="No categories found"
        emptySubtitle="Create a new category to get started"
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Category' : 'New Category'} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label="Category Name" required>
            <TextInput
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Linen, Vegetables, Room Service"
              required
            />
          </FormField>

          <FormField label="Type" required>
            <SelectInput
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as CategoryType })}
              required
            >
              <option value="RESTAURANT">Restaurant</option>
              <option value="BAR">Bar</option>
              <option value="POOL">Pool</option>
              <option value="EXPENDITURE">Expenditures</option>
              <option value="INVENTORY">Inventory</option>
              <option value="ROOM_TYPE">Room Types</option>
              <option value="OTHER">Other</option>
            </SelectInput>
          </FormField>

          <FormField label="Description">
            <TextInput
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
            />
          </FormField>

          <FormField label="Color">
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-10 w-16 rounded cursor-pointer border border-[#2B303E]"
              />
              <TextInput
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="#b18a55"
                className="flex-1"
              />
            </div>
          </FormField>

          <FormField label="Display Order">
            <TextInput
              type="number"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </FormField>

          <div className="pt-4 border-t border-[#2B303E] flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingId ? 'Update Category' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CategoriesPage;
