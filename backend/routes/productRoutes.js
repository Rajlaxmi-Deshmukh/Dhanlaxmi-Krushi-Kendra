const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
  addProduct,
  getProducts,
  getProductById,
  getMyOrders,
  searchProducts,
  searchByCategory,
  updateProductQuantity,
  deleteProduct
} = require("../controllers/productController");

router.get("/search", searchProducts);
router.get("/category", searchByCategory);

router.get("/", getProducts);

router.get("/:id", getProductById);
router.post("/", protect, adminOnly, upload.single("image"), addProduct);
router.put("/:id/quantity", protect, adminOnly, updateProductQuantity);
router.delete("/:id", protect, adminOnly, deleteProduct);

module.exports = router;
