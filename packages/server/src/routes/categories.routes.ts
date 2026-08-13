import { Router, Request, Response } from 'express';
import { authenticate, verifyActiveUser, requirePermission, type AuthenticatedRequest } from '../middleware/auth';
import { CategoryService } from '../services/categories.service';

const router = Router();

/**
 * GET /api/v1/categories
 * List categories (optionally filtered by type)
 * Query: type, includeInactive
 */
router.get('/', authenticate, verifyActiveUser, requirePermission('categories.view'), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { type, includeInactive } = req.query;
    const normalizedType = Array.isArray(type) ? type[0] : typeof type === 'string' ? type : undefined;

    const categories = await CategoryService.listAll({
      type: typeof normalizedType === 'string' ? normalizedType : undefined,
      includeInactive: includeInactive === 'true',
    });

    void authReq.user;
    res.json({ success: true, data: categories });
  } catch (err: any) {
    res.status(err.status || 500).json({ success: false, error: { code: 'CATEGORIES_LIST_FAILED', message: err.message } });
  }
});

/**
 * GET /api/v1/categories/:type
 * List categories by type
 */
router.get('/:type', authenticate, verifyActiveUser, requirePermission('categories.view'), async (req: Request, res: Response) => {
  try {
    const type = Array.isArray(req.params.type) ? req.params.type[0] : req.params.type;
    const categories = await CategoryService.listByType(String(type).toUpperCase());
    res.json({ success: true, data: categories });
  } catch (err: any) {
    res.status(err.status || 500).json({ success: false, error: { code: 'CATEGORIES_LIST_FAILED', message: err.message } });
  }
});

/**
 * POST /api/v1/categories
 * Create a new category
 * Required: categories.manage permission
 * Body: { name, type, description?, color?, order? }
 */
router.post('/', authenticate, verifyActiveUser, requirePermission('categories.manage'), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { name, type, description, color, order } = req.body;

    if (!name || !type) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name and type are required' } });
      return;
    }

    const category = await CategoryService.create(
      { name, type, description, color, order },
      authReq.user.userId
    );

    res.status(201).json({ success: true, data: category });
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: { code: 'CATEGORY_EXISTS', message: `Category "${req.body.name}" already exists for type ${req.body.type}` } });
    } else {
      res.status(err.status || 500).json({ success: false, error: { code: 'CATEGORY_CREATE_FAILED', message: err.message } });
    }
  }
});

/**
 * PUT /api/v1/categories/:id
 * Update a category
 * Required: categories.manage permission
 * Body: { name?, description?, color?, order?, isActive? }
 */
router.put('/:id', authenticate, verifyActiveUser, requirePermission('categories.manage'), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const category = await CategoryService.update(
      String(req.params.id),
      req.body,
      authReq.user.userId
    );

    res.json({ success: true, data: category });
  } catch (err: any) {
    if (err.message === 'Category not found') {
      res.status(404).json({ success: false, error: { code: 'CATEGORY_NOT_FOUND', message: err.message } });
    } else if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: { code: 'CATEGORY_EXISTS', message: 'Category name already exists for this type' } });
    } else {
      res.status(err.status || 500).json({ success: false, error: { code: 'CATEGORY_UPDATE_FAILED', message: err.message } });
    }
  }
});

/**
 * DELETE /api/v1/categories/:id
 * Delete a category (soft delete)
 * Required: categories.manage permission
 */
router.delete('/:id', authenticate, verifyActiveUser, requirePermission('categories.manage'), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const category = await CategoryService.delete(
      String(req.params.id),
      authReq.user.userId
    );

    res.json({ success: true, data: category });
  } catch (err: any) {
    if (err.message === 'Category not found') {
      res.status(404).json({ success: false, error: { code: 'CATEGORY_NOT_FOUND', message: err.message } });
    } else {
      res.status(err.status || 500).json({ success: false, error: { code: 'CATEGORY_DELETE_FAILED', message: err.message } });
    }
  }
});

/**
 * POST /api/v1/categories/reorder
 * Reorder categories
 * Required: categories.manage permission
 * Body: { updates: [{ id, order }, ...] }
 */
router.post('/reorder', authenticate, verifyActiveUser, requirePermission('categories.manage'), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Updates must be an array' } });
      return;
    }

    const result = await CategoryService.reorder(updates, authReq.user.userId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.status || 500).json({ success: false, error: { code: 'CATEGORIES_REORDER_FAILED', message: err.message } });
  }
});

export default router;
