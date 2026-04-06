const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { notifyAdmins } = require("./notificationController");

/* ================= LOGIN ================= */


exports.loginUser = async (req, res) => {
  try {
    /* ================= ADMIN LOGIN ================= */
    if (req.body && req.body.username) {
      const { username, password } = req.body;

      if (username === "admin" && password === "admin123") {
        const token = jwt.sign(
          { role: "admin" },
          process.env.JWT_SECRET,
          { expiresIn: "1d" }
        );

        return res.json({
          token,
          role: "admin"
        });
      }

      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    /* ================= USER LOGIN ================= */
    const { mobile, password } = req.body || {};

    if (!mobile || mobile.length !== 10) {
      return res.status(400).json({
        message: "Mobile number must be 10 digits"
      });
    }

    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({
        message: "You are a new user please sign in",
        newUser: true
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const role = user.role || "user";
    const token = jwt.sign(
      { id: user._id, role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      role,
      name: user.name
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= SIGNUP ================= */
exports.registerUser = async (req, res) => {
  const { name, mobile, password } = req.body;

  if (mobile.length !== 10) {
    return res.status(400).json({ message: "Mobile must be 10 digits" });
  }

  const exists = await User.findOne({ mobile });
  if (exists) {
    return res.status(409).json({ message: "User already exists" });
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    mobile,
    password: hashed,
    role: "user"
  });

  notifyAdmins(
    "New User Registered",
    `${user.name} (${user.mobile}) has created a new account.`,
    { userId: String(user._id), mobile: user.mobile, name: user.name },
    "user_registered"
  );

  res.status(201).json({ message: "Signup successful" });
};
