import { Router } from 'express';
import { supabase } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/job-sites
router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;

    let query = supabase
      .from('job_sites')
      .select('*')
      .order('name');

    if (q) {
      query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%`);
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/job-sites/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('job_sites')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new AppError(error.message, 404);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/job-sites
router.post('/', async (req, res, next) => {
  try {
    const { name, address, street_number, street_address, city, zip_code, county, latitude, longitude } = req.body;

    if (!name) {
      throw new AppError('Name is required');
    }

    const { data, error } = await supabase
      .from('job_sites')
      .insert({
        name,
        address,
        street_number,
        street_address,
        city,
        zip_code,
        county,
        latitude,
        longitude,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message);

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// PUT /api/job-sites/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, address, street_number, street_address, city, zip_code, county, latitude, longitude } = req.body;

    const { data, error } = await supabase
      .from('job_sites')
      .update({
        name,
        address,
        street_number,
        street_address,
        city,
        zip_code,
        county,
        latitude,
        longitude,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new AppError(error.message);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/job-sites/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('job_sites')
      .delete()
      .eq('id', id);

    if (error) throw new AppError(error.message);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
