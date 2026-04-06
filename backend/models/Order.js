const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
      },
      qty: Number,
      price: Number
    }
  ],
  status: {
    type: String,
    default: "Pending"
  },
  paymentMethod: {
    type: String,
    default: "Pending"
  },
  paymentStatus: {
    type: String,
    default: "Pending"
  },
  paymentProvider: {
    type: String,
    default: "None"
  },
  paymentAmount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
