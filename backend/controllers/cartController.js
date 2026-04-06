const Cart = require("../models/Cart");
const Product = require("../models/Product");

exports.getCart = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.id }).populate("items.product");
  if (!cart) return res.json({ items: [] });

  const validItems = (cart.items || []).filter(i => i.product);
  if (validItems.length !== cart.items.length) {
    cart.items = validItems;
    await cart.save();
  }

  res.json(cart);
};

exports.addToCart = async (req, res) => {
  const { productId, qty } = req.body || {};

  if (!productId) {
    return res.status(400).json({ message: "Product required" });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  if (product.quantity <= 0) {
    return res.status(400).json({ message: "Out of stock" });
  }

  let cart = await Cart.findOne({ user: req.user.id });
  if (!cart) cart = new Cart({ user: req.user.id, items: [] });

  const addQty = Math.max(parseInt(qty || 1, 10), 1);
  const index = cart.items.findIndex(
    i => i.product.toString() === productId
  );

  if (index > -1) {
    const desired = cart.items[index].qty + addQty;
    cart.items[index].qty = Math.min(desired, product.quantity);
  } else {
    cart.items.push({
      product: productId,
      qty: Math.min(addQty, product.quantity)
    });
  }

  await cart.save();
  res.json(cart);
};

exports.clearCart = async (req, res) => {
  await Cart.findOneAndDelete({ user: req.user.id });
  res.json({ message: "Cart cleared" });
};

exports.updateQuantity = async (req, res) => {
  try {
    const { productId, qty } = req.body || {};

    if (!productId || typeof qty !== "number") {
      return res.status(400).json({ message: "Invalid cart update" });
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const index = cart.items.findIndex(
      i => i.product.toString() === productId
    );

    if (index === -1) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    if (qty <= 0) {
      cart.items.splice(index, 1);
    } else {
      cart.items[index].qty = Math.min(qty, product.quantity);
    }

    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: "Failed to update cart" });
  }
};
