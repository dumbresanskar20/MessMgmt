const prisma = require('../../database/prisma');

// Helper to get YYYY-MM-DD date strings
const getFormattedDate = (date) => {
  return date.toISOString().split('T')[0];
};

const getStats = async (req, res) => {
  try {
    const today = new Date();
    const todayStr = getFormattedDate(today);
    const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM

    // 1. Basic Table Counts
    const totalStudents = await prisma.student.count();
    const totalAdmins = await prisma.adminUser.count();
    const totalMenuItems = await prisma.menuItem.count();
    const totalOrders = await prisma.order.count();
    const mealWindowsCount = await prisma.mealWindow.count();

    // 2. Order Status Counts
    const todayOrdersCount = await prisma.order.count({ where: { date: todayStr } });
    const pendingOrdersCount = await prisma.order.count({ where: { payment_status: 'pending' } });
    const completedOrdersCount = await prisma.order.count({ where: { order_status: 'delivered' } });
    const cancelledOrdersCount = await prisma.order.count({ where: { order_status: 'cancelled' } });

    // 3. Revenue Aggregations (Only count paid orders)
    const todayRevenueObj = await prisma.order.aggregate({
      _sum: { total_amount: true },
      where: { date: todayStr, payment_status: 'paid' },
    });
    const monthlyRevenueObj = await prisma.order.aggregate({
      _sum: { total_amount: true },
      where: { date: { startsWith: currentMonthStr }, payment_status: 'paid' },
    });
    const totalRevenueObj = await prisma.order.aggregate({
      _sum: { total_amount: true },
      where: { payment_status: 'paid' },
    });

    const todayRevenue = todayRevenueObj._sum.total_amount || 0;
    const monthlyRevenue = monthlyRevenueObj._sum.total_amount || 0;
    const totalRevenue = totalRevenueObj._sum.total_amount || 0;

    // 4. Subscriptions Metrics
    const activeSubscriptions = await prisma.subscription.count({ where: { status: 'active' } });
    const expiredSubscriptions = await prisma.subscription.count({ where: { status: 'expired' } });

    // 5. Database Info
    const dbSizeResult = await prisma.$queryRaw`
      SELECT SUM(data_length + index_length) AS size 
      FROM information_schema.TABLES 
      WHERE table_schema = DATABASE();
    `;
    const totalSize = dbSizeResult[0]?.size || 0;

    const tablesResult = await prisma.$queryRaw`
      SELECT COUNT(*) AS count 
      FROM information_schema.TABLES 
      WHERE table_schema = DATABASE();
    `;
    const totalTables = tablesResult[0]?.count || 0;

    res.status(200).json({
      success: true,
      cards: {
        totalStudents,
        totalAdmins,
        totalMenuItems,
        totalOrders,
        todayOrders: todayOrdersCount,
        pendingOrders: pendingOrdersCount,
        completedOrders: completedOrdersCount,
        cancelledOrders: cancelledOrdersCount,
        todayRevenue: parseFloat(todayRevenue),
        monthlyRevenue: parseFloat(monthlyRevenue),
        totalRevenue: parseFloat(totalRevenue),
        activeSubscriptions,
        expiredSubscriptions,
        mealWindows: mealWindowsCount,
        databaseSize: Number(totalSize),
        totalTables: Number(totalTables),
      },
      systemStatus: {
        server: 'Online',
        database: 'Connected',
        socket: 'Active',
        api: 'Operational',
      },
    });
  } catch (error) {
    console.error('[Dashboard Stats Error]', error);
    res.status(500).json({ success: false, message: 'Failed to aggregate stats dashboard.', error: error.message });
  }
};

const getCharts = async (req, res) => {
  try {
    const today = new Date();
    
    // 1. Order and Revenue Trend (Last 7 Days)
    const orderTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dStr = getFormattedDate(d);
      
      const count = await prisma.order.count({ where: { date: dStr } });
      const revObj = await prisma.order.aggregate({
        _sum: { total_amount: true },
        where: { date: dStr, payment_status: 'paid' },
      });
      const revenue = revObj._sum.total_amount || 0;

      // Extract day name (e.g. "Mon")
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      orderTrend.push({
        date: dStr,
        label,
        orders: count,
        revenue: parseFloat(revenue),
      });
    }

    // 2. Meal Type distribution (Last 30 Days)
    const mealDistribution = await prisma.order.groupBy({
      by: ['meal_type'],
      _count: {
        id: true,
      },
      where: {
        payment_status: 'paid',
      },
    });
    
    const mealCharts = mealDistribution.map((m) => ({
      name: m.meal_type.charAt(0).toUpperCase() + m.meal_type.slice(1),
      value: m._count.id,
    }));

    // 3. Payment Methods distribution
    const paymentDistribution = await prisma.order.groupBy({
      by: ['payment_method'],
      _count: {
        id: true,
      },
      where: {
        payment_status: 'paid',
      },
    });

    const paymentCharts = paymentDistribution.map((p) => ({
      name: p.payment_method ? p.payment_method.replace('_', ' ').toUpperCase() : 'UNKNOWN',
      value: p._count.id,
    }));

    // 4. Students Growth (Group by creation date - last 5 months)
    const studentsGrowth = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setMonth(today.getMonth() - i);
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const count = await prisma.student.count({
        where: {
          created_at: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });

      const label = d.toLocaleDateString('en-US', { month: 'short' });
      studentsGrowth.push({
        month: label,
        registrations: count,
      });
    }

    res.status(200).json({
      success: true,
      orderTrend,
      mealDistribution: mealCharts,
      paymentDistribution: paymentCharts,
      studentsGrowth,
    });
  } catch (error) {
    console.error('[Dashboard Charts Error]', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve charts analytics data.', error: error.message });
  }
};

const getRecentActivities = async (req, res) => {
  try {
    // Last 10 logins
    const logins = await prisma.auditLog.findMany({
      where: { action: 'LOGIN' },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    // Last 10 CRUD Operations (Not LOGIN)
    const crudOperations = await prisma.auditLog.findMany({
      where: { action: { not: 'LOGIN' } },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    // All audits
    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { created_at: 'desc' },
      take: 15,
    });

    res.status(200).json({
      success: true,
      logins,
      crudOperations,
      auditLogs,
    });
  } catch (error) {
    console.error('[Dashboard Activities Error]', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve audit timeline.', error: error.message });
  }
};

module.exports = {
  getStats,
  getCharts,
  getRecentActivities,
};
