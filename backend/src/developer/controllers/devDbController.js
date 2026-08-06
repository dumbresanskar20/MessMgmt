const prisma = require('../../database/prisma');

// 1. GET /api/developer/database/tables - Get all tables, sizes, row counts, and columns definitions
const getTables = async (req, res) => {
  try {
    // Query list of tables, sizes, and row counts from information_schema
    const tables = await prisma.$queryRaw`
      SELECT 
        TABLE_NAME AS name, 
        TABLE_ROWS AS \`rows\`, 
        DATA_LENGTH + INDEX_LENGTH AS size,
        CREATE_TIME AS created,
        UPDATE_TIME AS updated
      FROM information_schema.TABLES 
      WHERE table_schema = DATABASE();
    `;

    // Process each table to get columns, primary keys, and indexes
    const tablesWithMeta = await Promise.all(
      tables.map(async (table) => {
        const columns = await prisma.$queryRaw`
          SELECT 
            COLUMN_NAME AS name, 
            DATA_TYPE AS type, 
            IS_NULLABLE AS nullable, 
            COLUMN_KEY AS \`key\`, 
            COLUMN_DEFAULT AS \`default\`
          FROM information_schema.COLUMNS 
          WHERE table_schema = DATABASE() AND table_name = ${table.name};
        `;

        const indexes = await prisma.$queryRaw`
          SELECT 
            INDEX_NAME AS name,
            COLUMN_NAME AS \`column\`,
            NON_UNIQUE AS nonUnique
          FROM information_schema.STATISTICS
          WHERE table_schema = DATABASE() AND table_name = ${table.name};
        `;

        return {
          name: table.name,
          rows: table.rows !== null && table.rows !== undefined ? Number(table.rows) : 0,
          size: table.size !== null && table.size !== undefined ? Number(table.size) : 0,
          created: table.created,
          updated: table.updated,
          columns: columns.map(col => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable,
            key: col.key,
            default: col.default
          })),
          indexes: indexes.map(idx => ({
            name: idx.name,
            column: idx.column,
            nonUnique: idx.nonUnique !== null && idx.nonUnique !== undefined ? Number(idx.nonUnique) : 0
          })),
        };
      })
    );

    // Calculate DB metrics
    const dbSizeResult = await prisma.$queryRaw`
      SELECT SUM(data_length + index_length) AS size 
      FROM information_schema.TABLES 
      WHERE table_schema = DATABASE();
    `;
    const totalSize = dbSizeResult[0]?.size || 0;

    res.status(200).json({
      success: true,
      tables: tablesWithMeta,
      databaseMetrics: {
        totalTables: tables.length,
        totalSize: Number(totalSize),
        status: 'Healthy',
      },
    });
  } catch (error) {
    console.error('[Get Database Tables Error]', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve database information.', error: error.message });
  }
};

// 2. GET /api/developer/database/backup - Generate a downloadable SQL backup of the MySQL database
const generateBackup = async (req, res) => {
  try {
    // 1. Fetch all tables from the database
    const tables = await prisma.$queryRaw`
      SHOW TABLES;
    `;
    
    // MySQL SHOW TABLES returns keys depending on database name, e.g. "Tables_in_defaultdb"
    // Let's resolve the key dynamically
    if (tables.length === 0) {
      return res.status(200).send('-- No tables found in database --');
    }
    const key = Object.keys(tables[0])[0];
    const tableNames = tables.map(t => t[key]);

    let sqlDump = '';
    sqlDump += `-- Mess Management System SQL Dump\n`;
    sqlDump += `-- Date: ${new Date().toISOString()}\n`;
    sqlDump += `-- Database: defaultdb\n`;
    sqlDump += `\nSET FOREIGN_KEY_CHECKS = 0;\n\n`;

    // 2. Loop over tables and dump structure + inserts
    for (const tableName of tableNames) {
      // Get Create Table SQL
      const createTableResult = await prisma.$queryRawUnsafe(`SHOW CREATE TABLE \`${tableName}\`;`);
      const createTableSql = createTableResult[0]['Create Table'];
      
      sqlDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      sqlDump += `${createTableSql};\n\n`;

      // Get all table rows
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM \`${tableName}\`;`);
      
      if (rows.length > 0) {
        sqlDump += `LOCK TABLES \`${tableName}\` WRITE;\n`;
        sqlDump += `INSERT INTO \`${tableName}\` VALUES \n`;
        
        const valueStrings = rows.map(row => {
          const values = Object.values(row).map(val => {
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            if (typeof val === 'boolean') return val ? 1 : 0;
            return val;
          });
          return `(${values.join(', ')})`;
        });
        
        sqlDump += valueStrings.join(',\n') + ';\n';
        sqlDump += `UNLOCK TABLES;\n\n`;
      }
    }

    sqlDump += `SET FOREIGN_KEY_CHECKS = 1;\n`;

    // Send backup as download attachment
    res.setHeader('Content-disposition', `attachment; filename=mess_db_backup_${new Date().toISOString().slice(0,10)}.sql`);
    res.setHeader('Content-type', 'application/sql');
    res.status(200).send(sqlDump);
  } catch (error) {
    console.error('[Generate Database Backup Error]', error);
    res.status(500).json({ success: false, message: 'Failed to generate database backup.', error: error.message });
  }
};

module.exports = {
  getTables,
  generateBackup,
};
