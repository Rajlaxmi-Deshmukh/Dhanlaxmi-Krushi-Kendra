const Notification = require("../models/Notification");

exports.notifyAdmins = async (title, message, metadata = {}, type = "system") => {
  try {
    await Notification.create({ title, message, metadata, type, isRead: false });
  } catch (err) {
    console.error("Notification create failed:", err.message || err);
  }
};

// Kept for compatibility with existing calls from order controller.
exports.notifyUser = async () => {};

exports.getAdminNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: "Failed to load notifications" });
  }
};

exports.getAdminUnreadCount = async (req, res) => {
  try {
    const unread = await Notification.countDocuments({ isRead: false });
    res.json({ unread });
  } catch (err) {
    res.status(500).json({ message: "Failed to load unread count" });
  }
};

exports.markAdminNotificationsRead = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];

    if (ids.length > 0) {
      await Notification.updateMany(
        { _id: { $in: ids } },
        { $set: { isRead: true, readAt: new Date() } }
      );
    } else {
      await Notification.updateMany(
        { isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
      );
    }

    res.json({ message: "Notifications marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark notifications read" });
  }
};
