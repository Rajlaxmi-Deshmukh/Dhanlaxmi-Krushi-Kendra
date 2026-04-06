// backend/server.js

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const cartRoutes = require("./routes/cartRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const Product = require("./models/Product");
const Order = require("./models/Order");

const app = express();

/* =======================
   DATABASE CONNECTION
======================= */
connectDB();

/* =======================
   MIDDLEWARE (FIRST)
======================= */
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5000,http://127.0.0.1:5000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json());


/* =======================
   STATIC FILES
======================= */
app.use("/uploads", express.static("uploads"));
app.use(express.static(path.join(__dirname, "../frontend")));

/* =======================
   API ROUTES
======================= */
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);

/* =======================
   SSE: PRODUCTS STREAM
======================= */
const productClients = new Set();
let productChangeStream;
let productPingInterval;

function startProductStream() {
  if (productChangeStream) return;
  try {
    productChangeStream = Product.watch([], { fullDocument: "updateLookup" });
    productChangeStream.on("change", (change) => {
      const payload = {
        type: change.operationType,
        document: change.fullDocument || null
      };
      for (const res of productClients) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    });
    productChangeStream.on("error", (err) => {
      console.error("Product change stream error:", err.message || err);
      productChangeStream = null;
      setTimeout(startProductStream, 5000);
    });
  } catch (err) {
    console.error("Failed to start product change stream:", err.message || err);
  }
}

function startProductPing() {
  if (productPingInterval) return;
  productPingInterval = setInterval(() => {
    for (const res of productClients) {
      res.write(`event: ping\ndata: {}\n\n`);
    }
  }, 25000);
}

app.get("/api/stream/products", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write(`event: connected\ndata: ok\n\n`);
  productClients.add(res);
  startProductStream();
  startProductPing();

  req.on("close", () => {
    productClients.delete(res);
    if (productClients.size === 0) {
      if (productChangeStream) {
        productChangeStream.close();
        productChangeStream = null;
      }
      if (productPingInterval) {
        clearInterval(productPingInterval);
        productPingInterval = null;
      }
    }
  });
});

/* =======================
   SSE: ORDERS STREAM
======================= */
const orderClients = new Set();
let orderChangeStream;
let orderPingInterval;

function startOrderStream() {
  if (orderChangeStream) return;
  try {
    orderChangeStream = Order.watch([], { fullDocument: "updateLookup" });
    orderChangeStream.on("change", (change) => {
      const payload = {
        type: change.operationType,
        document: change.fullDocument || null
      };
      for (const res of orderClients) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    });
    orderChangeStream.on("error", (err) => {
      console.error("Order change stream error:", err.message || err);
      orderChangeStream = null;
      setTimeout(startOrderStream, 5000);
    });
  } catch (err) {
    console.error("Failed to start order change stream:", err.message || err);
  }
}

function startOrderPing() {
  if (orderPingInterval) return;
  orderPingInterval = setInterval(() => {
    for (const res of orderClients) {
      res.write(`event: ping\ndata: {}\n\n`);
    }
  }, 25000);
}

app.get("/api/stream/orders", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write(`event: connected\ndata: ok\n\n`);
  orderClients.add(res);
  startOrderStream();
  startOrderPing();

  req.on("close", () => {
    orderClients.delete(res);
    if (orderClients.size === 0) {
      if (orderChangeStream) {
        orderChangeStream.close();
        orderChangeStream = null;
      }
      if (orderPingInterval) {
        clearInterval(orderPingInterval);
        orderPingInterval = null;
      }
    }
  });
});

/* =======================
   FRONTEND ROUTES
======================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

app.get("/admin-login", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/admin-login.html"));
});

app.get("/user-login", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/user-login.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/signup.html"));
});

app.get("/signin", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/signup.html"));
});

app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/home.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/admin.html"));
});

app.get("/orders", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/orders.html"));
});

app.get("/cart", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/cart.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/aboutus.html"));
});

app.get("/products", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/products.html"));
});

app.get("/schedule", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/schedule.html"));
});

app.get("/payment", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/payment.html"));
});

app.get("/fertilizers", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/products.html"));
});

app.get("/herbicides", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/products.html"));
});

/* =======================
   SERVER START
======================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
