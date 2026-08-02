const cron = require('node-cron');
const prisma = require('../config/prisma');

/**
 * Permanently delete orders older than the specified retention window (default: 60 days).
 * OrderItem rows are automatically cascade-deleted via the onDelete: Cascade FK on OrderItem.order_id.
 *
 * @returns {Promise<{ deletedCount: number, cutoffDate: Date, retentionDays: number }>}
 */
const cleanupOldOrders = async () => {
  const retentionDays = parseInt(process.env.ORDER_RETENTION_DAYS, 10) || 60;
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  try {
    const result = await prisma.order.deleteMany({
      where: {
        created_at: { lt: cutoffDate },
      },
    });

    const deletedCount = result.count || 0;
    const logTimestamp = now.toISOString();

    if (deletedCount > 0) {
      console.log(
        `🧹 [Order Cleanup Job] Successfully deleted ${deletedCount} expired order(s) older than ${retentionDays} days (Cutoff: ${cutoffDate.toISOString()}) on ${logTimestamp}`
      );
    } else {
      console.log(
        `🧹 [Order Cleanup Job] Zero expired orders found older than ${retentionDays} days (Cutoff: ${cutoffDate.toISOString()}) on ${logTimestamp}`
      );
    }

    return { deletedCount, cutoffDate, retentionDays, timestamp: logTimestamp };
  } catch (error) {
    console.error(`❌ [Order Cleanup Job Error] Failed to execute cleanup job: ${error.message}`);
    return { error: error.message, deletedCount: 0 };
  }
};

/**
 * Initialize daily scheduled cron job (runs every day at 02:00 AM server time)
 */
const initOrderCleanupJob = () => {
  const schedulePattern = process.env.ORDER_CLEANUP_CRON || '0 2 * * *';

  cron.schedule(schedulePattern, async () => {
    console.log('[Order Cleanup Job] Scheduled daily trigger started...');
    await cleanupOldOrders();
  });

  console.log(`[Order Cleanup Job] Scheduled daily cleanup job active with pattern '${schedulePattern}'`);
};

module.exports = {
  cleanupOldOrders,
  initOrderCleanupJob,
};
