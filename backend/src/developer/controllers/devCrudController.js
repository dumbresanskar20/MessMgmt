const prisma = require('../../database/prisma');

// Helper to resolve the correct camelCase property name on Prisma client
const resolvePrismaModel = (modelName) => {
  if (!modelName) return null;
  
  // Standardize name: E.g., 'AdminUser' or 'admin-user' -> 'adminUser'
  let cleanName = modelName.trim();
  let camelName = cleanName.charAt(0).toLowerCase() + cleanName.slice(1);
  if (camelName.includes('-')) {
    camelName = camelName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  if (prisma[camelName]) {
    return camelName;
  }

  // Fallback: Case insensitive match
  const keys = Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'));
  const found = keys.find(k => k.toLowerCase() === camelName.toLowerCase());
  return found || null;
};

// Log developer actions to AuditLog
const logAudit = async (req, action, module, recordId = null) => {
  try {
    const devEmail = req.developer ? req.developer.email : 'system@mess.com';
    await prisma.auditLog.create({
      data: {
        user_email: devEmail,
        action: `${action} [ID: ${recordId || 'Bulk'}]`,
        module: module.toUpperCase(),
        ip_address: req.ip || req.headers['x-forwarded-for'] || null,
        browser: req.headers['user-agent'] || null,
      },
    });
  } catch (error) {
    console.error('[Audit Logging Failed]', error.message);
  }
};

// 1. GET /api/developer/crud/:model - List records with pagination, sorting, filtering, and dynamic search
const list = async (req, res) => {
  try {
    const { model } = req.params;
    const prismaModel = resolvePrismaModel(model);
    if (!prismaModel) {
      return res.status(404).json({ success: false, message: `Model '${model}' not found in database schema.` });
    }

    let { page = 1, limit = 10, sortBy, sortOrder = 'desc', search = '', filters = '{}' } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    
    // Parse filters JSON
    let filterObj = {};
    try {
      filterObj = JSON.parse(filters);
    } catch (e) {
      filterObj = {};
    }

    // Initialize Prisma query parameters
    const queryParams = {
      where: {},
    };

    // Apply specific filters
    Object.keys(filterObj).forEach((key) => {
      const val = filterObj[key];
      if (val !== undefined && val !== null && val !== '') {
        if (typeof val === 'string') {
          // Check if string filter represents boolean or number
          if (val === 'true') filterObj[key] = true;
          else if (val === 'false') filterObj[key] = false;
        }
        queryParams.where[key] = filterObj[key];
      }
    });

    // Apply dynamic search across all string fields of this table
    if (search) {
      try {
        // Query columns for this table to detect string types
        const columns = await prisma.$queryRaw`
          SELECT COLUMN_NAME AS name, DATA_TYPE AS type
          FROM information_schema.COLUMNS
          WHERE table_schema = DATABASE() AND table_name = ${model};
        `;

        if (columns && columns.length > 0) {
          const stringFields = columns
            .filter((c) => ['varchar', 'text', 'char', 'longtext'].includes(c.type.toLowerCase()))
            .map((c) => c.name);

          if (stringFields.length > 0) {
            queryParams.where.OR = stringFields.map((field) => ({
              [field]: {
                contains: search,
              },
            }));
          }
        }
      } catch (e) {
        // Fallback search parameters if queryRaw fails
        console.warn('[CRUD Search Fallback] Failed columns retrieval, using name/email search:', e.message);
        queryParams.where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
        ].filter(f => Object.keys(f).some(k => k in queryParams.where || true));
      }
    }

    // Total record count matching criteria
    const total = await prisma[prismaModel].count({ where: queryParams.where });

    // Apply Sorting
    if (sortBy) {
      queryParams.orderBy = {
        [sortBy]: sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc',
      };
    } else {
      // Try to order by id or created_at if present
      queryParams.orderBy = {
        id: 'desc',
      };
    }

    // Apply Pagination
    if (limit > 0) {
      queryParams.skip = (page - 1) * limit;
      queryParams.take = limit;
    }

    const records = await prisma[prismaModel].findMany(queryParams);

    res.status(200).json({
      success: true,
      records,
      pagination: {
        total,
        page,
        limit,
        pages: limit > 0 ? Math.ceil(total / limit) : 1,
      },
    });
  } catch (error) {
    console.error('[CRUD List Error]', error);
    res.status(500).json({ success: false, message: 'Error retrieving database records.', error: error.message });
  }
};

// 2. GET /api/developer/crud/:model/:id - Fetch a single record by ID
const get = async (req, res) => {
  try {
    const { model, id } = req.params;
    const prismaModel = resolvePrismaModel(model);
    if (!prismaModel) {
      return res.status(404).json({ success: false, message: `Model '${model}' not found.` });
    }

    const recordId = isNaN(id) ? id : parseInt(id);
    const record = await prisma[prismaModel].findUnique({
      where: { id: recordId },
    });

    if (!record) {
      return res.status(404).json({ success: false, message: `Record with ID '${id}' not found.` });
    }

    res.status(200).json({ success: true, record });
  } catch (error) {
    console.error('[CRUD Get Error]', error);
    res.status(500).json({ success: false, message: 'Error fetching record detail.', error: error.message });
  }
};

// 3. POST /api/developer/crud/:model - Create a record
const create = async (req, res) => {
  try {
    const { model } = req.params;
    const prismaModel = resolvePrismaModel(model);
    if (!prismaModel) {
      return res.status(404).json({ success: false, message: `Model '${model}' not found.` });
    }

    const data = req.body;
    
    // Automatically parse numbers/dates if passed as strings from standard fields
    // Prisma will validate schema types, let's catch standard numbers
    Object.keys(data).forEach(k => {
      if (k.endsWith('_id') && typeof data[k] === 'string' && !isNaN(data[k])) {
        data[k] = parseInt(data[k]);
      }
    });

    const record = await prisma[prismaModel].create({ data });
    await logAudit(req, 'CREATE', model, record.id);

    res.status(201).json({ success: true, record, message: 'Record created successfully.' });
  } catch (error) {
    console.error('[CRUD Create Error]', error);
    res.status(400).json({ success: false, message: 'Failed to create record. Verify input types.', error: error.message });
  }
};

// 4. PUT /api/developer/crud/:model/:id - Update a record
const update = async (req, res) => {
  try {
    const { model, id } = req.params;
    const prismaModel = resolvePrismaModel(model);
    if (!prismaModel) {
      return res.status(404).json({ success: false, message: `Model '${model}' not found.` });
    }

    const recordId = isNaN(id) ? id : parseInt(id);
    const data = req.body;

    // Filter out read-only fields
    const { id: _, created_at, updated_at, ...updateData } = data;

    // Handle number formatting
    Object.keys(updateData).forEach(k => {
      if (k.endsWith('_id') && typeof updateData[k] === 'string' && !isNaN(updateData[k])) {
        updateData[k] = parseInt(updateData[k]);
      }
    });

    const record = await prisma[prismaModel].update({
      where: { id: recordId },
      data: updateData,
    });

    await logAudit(req, 'UPDATE', model, recordId);

    res.status(200).json({ success: true, record, message: 'Record updated successfully.' });
  } catch (error) {
    console.error('[CRUD Update Error]', error);
    res.status(400).json({ success: false, message: 'Failed to update record. Verify input types.', error: error.message });
  }
};

// 5. DELETE /api/developer/crud/:model/:id - Delete a record
const remove = async (req, res) => {
  try {
    const { model, id } = req.params;
    const prismaModel = resolvePrismaModel(model);
    if (!prismaModel) {
      return res.status(404).json({ success: false, message: `Model '${model}' not found.` });
    }

    const recordId = isNaN(id) ? id : parseInt(id);

    await prisma[prismaModel].delete({
      where: { id: recordId },
    });

    await logAudit(req, 'DELETE', model, recordId);

    res.status(200).json({ success: true, message: 'Record deleted successfully.' });
  } catch (error) {
    console.error('[CRUD Delete Error]', error);
    res.status(400).json({ success: false, message: 'Failed to delete record.', error: error.message });
  }
};

// 6. POST /api/developer/crud/:model/bulk-delete - Bulk delete records
const bulkDelete = async (req, res) => {
  try {
    const { model } = req.params;
    const { ids } = req.body; // Array of IDs to delete
    const prismaModel = resolvePrismaModel(model);
    if (!prismaModel) {
      return res.status(404).json({ success: false, message: `Model '${model}' not found.` });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'IDs array is required for bulk delete.' });
    }

    const parsedIds = ids.map(id => (isNaN(id) ? id : parseInt(id)));

    const result = await prisma[prismaModel].deleteMany({
      where: {
        id: { in: parsedIds },
      },
    });

    await logAudit(req, `BULK_DELETE (${result.count} records)`, model);

    res.status(200).json({ success: true, count: result.count, message: `${result.count} records deleted successfully.` });
  } catch (error) {
    console.error('[CRUD Bulk Delete Error]', error);
    res.status(400).json({ success: false, message: 'Failed to delete records in bulk.', error: error.message });
  }
};

// 7. POST /api/developer/crud/:model/bulk-update - Bulk update records
const bulkUpdate = async (req, res) => {
  try {
    const { model } = req.params;
    const { ids, data } = req.body;
    const prismaModel = resolvePrismaModel(model);
    if (!prismaModel) {
      return res.status(404).json({ success: false, message: `Model '${model}' not found.` });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0 || !data) {
      return res.status(400).json({ success: false, message: 'IDs array and update data are required.' });
    }

    const parsedIds = ids.map(id => (isNaN(id) ? id : parseInt(id)));

    const result = await prisma[prismaModel].updateMany({
      where: {
        id: { in: parsedIds },
      },
      data,
    });

    await logAudit(req, `BULK_UPDATE (${result.count} records)`, model);

    res.status(200).json({ success: true, count: result.count, message: `${result.count} records updated successfully.` });
  } catch (error) {
    console.error('[CRUD Bulk Update Error]', error);
    res.status(400).json({ success: false, message: 'Failed to update records in bulk.', error: error.message });
  }
};

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  bulkDelete,
  bulkUpdate,
};
