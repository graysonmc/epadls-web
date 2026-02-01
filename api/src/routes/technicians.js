import express from 'express';
import { supabase } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// GET /api/technicians - Get all technicians
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .order('name');

    if (error) throw new AppError(error.message);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/technicians/:id - Get single technician
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new AppError(error.message);
    if (!data) throw new AppError('Technician not found', 404);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/technicians - Create technician
router.post('/', async (req, res, next) => {
  try {
    const { name, phone, email, is_active = true } = req.body;

    if (!name) {
      throw new AppError('Name is required', 400);
    }

    const { data, error } = await supabase
      .from('technicians')
      .insert([{ name, phone, email, is_active }])
      .select()
      .single();

    if (error) throw new AppError(error.message);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// PUT /api/technicians/:id - Update technician
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, email, is_active } = req.body;

    const { data, error } = await supabase
      .from('technicians')
      .update({ name, phone, email, is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message);
    if (!data) throw new AppError('Technician not found', 404);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/technicians/:id - Delete technician
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('technicians')
      .delete()
      .eq('id', id);

    if (error) throw new AppError(error.message);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
