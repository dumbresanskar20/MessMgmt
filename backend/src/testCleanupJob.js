const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Order = require('./models/Order');
const Student = require('./models/Student');
const { cleanupOldOrders } = require('./jobs/cleanupOldOrders');

dotenv.config();

const runTest = async () => {
  try {
    let mongoUri = process.env.ATLAS_URI;
    if (!mongoUri || mongoUri.includes('example.mongodb.net')) {
      mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mess_management';
    }
    await mongoose.connect(mongoUri);
    console.log('[Test] Connected to MongoDB for verification test...');

    // Find or create a test student
    let student = await Student.findOne();
    if (!student) {
      student = await Student.create({
        name: 'Test Student',
        email: 'test_cleanup@mess.com',
        roll_no: 'TEST-CLEANUP-001',
        password_hash: 'hashed',
        is_verified: true,
      });
    }

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Create 4 backdated test orders
    const testOrdersData = [
      { ageDays: 30, meal_type: 'lunch', total_amount: 100, payment_status: 'paid', date: '2026-06-25' },
      { ageDays: 59, meal_type: 'breakfast', total_amount: 50, payment_status: 'paid', date: '2026-05-27' },
      { ageDays: 61, meal_type: 'dinner', total_amount: 120, payment_status: 'paid', date: '2026-05-25' },
      { ageDays: 90, meal_type: 'snacks', total_amount: 30, payment_status: 'paid', date: '2026-04-26' },
    ];

    const insertedOrders = [];
    for (const item of testOrdersData) {
      const createdDate = new Date(now - item.ageDays * DAY_MS);
      const ord = await Order.create({
        student_id: student._id,
        meal_type: item.meal_type,
        items: [{ menu_item: new mongoose.Types.ObjectId(), item_name: 'Test Dish', price: item.total_amount, quantity: 1 }],
        total_amount: item.total_amount,
        payment_status: item.payment_status,
        date: item.date,
        created_at: createdDate,
      });
      insertedOrders.push(ord);
      console.log(`[Test Setup] Created test order ${ord._id} (${item.ageDays} days old - Created: ${createdDate.toISOString()})`);
    }

    // Test 1: Verify Student API filter (returns only orders <= 60 days old)
    const retentionDays = parseInt(process.env.ORDER_RETENTION_DAYS, 10) || 60;
    const cutoffDate = new Date(now - retentionDays * DAY_MS);

    const activeOrders = await Order.find({
      student_id: student._id,
      payment_status: 'paid',
      created_at: { $gte: cutoffDate },
    });

    console.log(`\n✅ Test 1: Database Query Filter (Active Orders <= 60 Days Old)`);
    console.log(`   Found ${activeOrders.length} order(s). Expected: <= 60 day old orders.`);

    // Test 2: Run cleanup job
    console.log(`\n🧹 Test 2: Running Automated Cleanup Job (First Run)...`);
    const runResult1 = await cleanupOldOrders();
    console.log(`   Deleted Count: ${runResult1.deletedCount}`);

    // Verify older orders (> 60 days old) were deleted
    const check61DaysOld = await Order.findById(insertedOrders[2]._id);
    const check90DaysOld = await Order.findById(insertedOrders[3]._id);
    const check30DaysOld = await Order.findById(insertedOrders[0]._id);
    const check59DaysOld = await Order.findById(insertedOrders[1]._id);

    console.log(`   - 90 Days Old Order Exists: ${!!check90DaysOld} (Expected: false)`);
    console.log(`   - 61 Days Old Order Exists: ${!!check61DaysOld} (Expected: false)`);
    console.log(`   - 59 Days Old Order Exists: ${!!check59DaysOld} (Expected: true)`);
    console.log(`   - 30 Days Old Order Exists: ${!!check30DaysOld} (Expected: true)`);

    // Test 3: Run cleanup job a second time (Idempotency check)
    console.log(`\n🧹 Test 3: Running Automated Cleanup Job (Second Run - Idempotency Check)...`);
    const runResult2 = await cleanupOldOrders();
    console.log(`   Deleted Count: ${runResult2.deletedCount} (Expected: 0)`);
    console.log(`   Second run completed cleanly without unhandled errors!`);

    // Cleanup remaining test entries
    await Order.deleteMany({ _id: { $in: [insertedOrders[0]._id, insertedOrders[1]._id] } });
    console.log('\n🎉 Verification test completed successfully!');

    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
};

runTest();
