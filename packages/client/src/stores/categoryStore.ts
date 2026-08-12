import { create } from 'zustand';
import { categoriesApi, type ItemCategory } from '../services/apiService';

interface CategoryStore {
  categories: ItemCategory[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadByType: (type: string) => Promise<void>;
  loadAll: (params?: { type?: string; includeInactive?: boolean }) => Promise<void>;
  createCategory: (data: { name: string; type: string; description?: string; color?: string; order?: number }) => Promise<ItemCategory>;
  updateCategory: (id: string, data: Partial<Omit<ItemCategory, 'id' | 'type' | 'createdAt' | 'updatedAt'>>) => Promise<ItemCategory>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (updates: Array<{ id: string; order: number }>) => Promise<void>;
  clearError: () => void;
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  categories: [],
  isLoading: false,
  error: null,

  loadByType: async (type: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await categoriesApi.listByType(type);
      set({ categories: result.data });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  loadAll: async (params?: { type?: string; includeInactive?: boolean }) => {
    set({ isLoading: true, error: null });
    try {
      const result = await categoriesApi.listAll(params);
      set({ categories: result.data });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createCategory: async (data) => {
    try {
      const result = await categoriesApi.create(data);
      set((state) => ({ categories: [...state.categories, result.data] }));
      return result.data;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateCategory: async (id, data) => {
    try {
      const result = await categoriesApi.update(id, data);
      set((state) => ({
        categories: state.categories.map((c) => (c.id === id ? result.data : c)),
      }));
      return result.data;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteCategory: async (id) => {
    try {
      await categoriesApi.delete(id);
      set((state) => ({
        categories: state.categories.filter((c) => c.id !== id),
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  reorderCategories: async (updates) => {
    try {
      const result = await categoriesApi.reorder(updates);
      set({ categories: result.data });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
