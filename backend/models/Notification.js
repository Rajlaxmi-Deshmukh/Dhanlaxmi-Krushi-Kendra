const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["user_registered", "order_placed", "order_update", "system"],
      default: "system"
    },
    metadata: { type: Object, default: {} },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
