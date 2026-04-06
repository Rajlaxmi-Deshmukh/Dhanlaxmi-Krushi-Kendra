const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getCart,
  addToCart,
  clearCart,
  updateQuantity
} = require("../controllers/cartController");

router.get("/", protect, getCart);
router.post("/", protect, addToCart);
router.delete("/", protect, clearCart);
router.put("/update", protect, updateQuantity);

module.exports = router;
