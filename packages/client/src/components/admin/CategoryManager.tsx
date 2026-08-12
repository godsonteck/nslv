import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { Modal, Button, TextInput, FormField, showToast } from '../../components/ui';
import { useCategoryStore } from '../../stores/categoryStore';
import type { ItemCategory } from '../../services/apiService';

interface CategoryManagerProps {
  type: string; // RESTAURANT | BAR | POOL | INVENTORY | EXPENSE
  title: string;
  onClose?: () => void;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ type, title, onClose }) => {
  const { categories, isLoading, createCategory, updateCategory, deleteCategory, loadByType } = useCategoryStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ItemCategory | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', color: '#174b59' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadByType(type);
  }, [type, loadByType]);

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData({ name: '', description: '', color: '#174b59' });
    setOpen(true);
  };

  const handleOpenEdit = (cat: ItemCategory) => {
    setEditing(cat);
    setFormData({
      name: cat.name,
      description: cat.description || '',
      color: cat.color || '#174b59',
    });
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('error', 'Category name is required');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, {
          name: formData.name,
          description: formData.description || undefined,
          color: formData.color,
        });
        showToast('success', 'Category updated');
      } else {
        await createCategory({
          name: formData.name,
          type,
          description: formData.description || undefined,
          color: formData.color,
          order: categories.length,
        });
        showToast('success', 'Category created');
      }
      setOpen(false);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: ItemCategory) => {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;

    try {
      await deleteCategory(cat.id);
      showToast('success', 'Category deleted');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete category');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#14232b]">{title}</h3>
        <Button size="sm" variant="primary" onClick={handleOpenAdd}>
          <Plus size={14} /> Add
        </Button>
      </div>

      {isLoading ? (
        <div className="py-4 text-center text-xs text-[#7a858a]">Loading categories...</div>
      ) : categories.length === 0 ? (
        <div className="py-4 text-center text-xs text-[#7a858a]">No categories yet</div>
      ) : (
        <div className="space-y-1">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[#e6e8e5] bg-white px-3 py-2.5 hover:bg-[#f9faf8]"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <GripVertical size={14} className="shrink-0 text-[#a0a5ad] cursor-grab" />
                <div
                  className="shrink-0 w-4 h-4 rounded"
                  style={{ backgroundColor: cat.color || '#174b59' }}
                  title={cat.color}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-xs text-[#14232b]">{cat.name}</div>
                  {cat.description && (
                    <div className="text-[10px] text-[#7a858a] line-clamp-1">{cat.description}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleOpenEdit(cat)}
                  className="p-1.5 hover:bg-[#f0f2ef] rounded-lg transition text-[#718086]"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(cat)}
                  className="p-1.5 hover:bg-[#fef2f2] rounded-lg transition text-[#b84b4b]"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Category' : 'New Category'} size="md">
        <form onSubmit={handleSave} className="space-y-4 p-6">
          <FormField label="Category Name">
            <TextInput
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Appetizers"
              autoFocus
            />
          </FormField>

          <FormField label="Description (optional)">
            <TextInput
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description or notes"
            />
          </FormField>

          <FormField label="Color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-10 w-16 rounded cursor-pointer border border-[#2B303E]"
              />
              <span className="text-xs font-mono text-[#7a858a]">{formData.color}</span>
            </div>
          </FormField>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={saving}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CategoryManager;
