const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");

const {
  createOrder,
  getOrders,
  getMyOrders,
  approveOrder,
  cancelOrder,
  setPaymentMethod,
  confirmPayment,
  getOrderById,
  rejectOrder
} = require("../controllers/orderController");

// USER -> PLACE ORDER
router.post("/", protect, createOrder);

// ADMIN -> GET ALL ORDERS
router.get("/", protect, getOrders);
router.get("/my", protect, getMyOrders);
router.get("/:id", protect, getOrderById);

// ADMIN -> APPROVE ORDER
router.put("/:id", protect, approveOrder);

router.put("/:id/cancel", protect, cancelOrder);

// ADMIN -> REJECT ORDER
router.put("/:id/reject", protect, adminOnly, rejectOrder);

// USER -> SET PAYMENT METHOD
router.put("/:id/payment", protect, setPaymentMethod);

// ADMIN -> CONFIRM PAYMENT
router.put("/:id/confirm-payment", protect, adminOnly, confirmPayment);

module.exports = router;
