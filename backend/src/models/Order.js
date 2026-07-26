const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menu_item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
  },
  item_name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
});

const orderSchema = new mongoose.Schema(
  {
    student_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    meal_type: {
      type: String,
      required: true,
      enum: ['breakfast', 'lunch', 'dinner', 'snacks'],
    },
    items: [orderItemSchema],
    total_amount: {
      type: Number,
      required: true,
    },
    payment_status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    razorpay_order_id: {
      type: String,
      default: null,
    },
    razorpay_payment_id: {
      type: String,
      default: null,
    },
    razorpay_signature: {
      type: String,
      default: null,
    },
    token_number: {
      type: String,
      default: null, // e.g. "B-001", "L-014"
    },
    daily_sequence: {
      type: Number,
      default: 0,
    },
    order_status: {
      type: String,
      enum: ['placed', 'preparing', 'ready', 'delivered', 'cancelled'],
      default: 'placed',
    },
    date: {
      type: String,
      required: true, // YYYY-MM-DD format
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

orderSchema.index({ student_id: 1, date: 1 });
orderSchema.index({ date: 1, meal_type: 1, payment_status: 1 });
orderSchema.index({ order_status: 1 });

module.exports = mongoose.model('Order', orderSchema);
