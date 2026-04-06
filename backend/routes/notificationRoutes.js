const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
  getAdminNotifications,
  getAdminUnreadCount,
  markAdminNotificationsRead
} = require("../controllers/notificationController");

router.get("/admin", protect, adminOnly, getAdminNotifications);
router.get("/admin/unread-count", protect, adminOnly, getAdminUnreadCount);
router.put("/admin/mark-read", protect, adminOnly, markAdminNotificationsRead);


module.exports = router;
