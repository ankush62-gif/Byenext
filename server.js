const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json());

let data = {
  users: [
    {
      id: 1,
      name: "Admin",
      email: "admin@byenext.com",
      password: "Admin@123",
      role: "admin"
    }
  ],
  products: [
    {
      id: 1,
      name: "Smartphone",
      description: "Latest smartphone",
      price: 9999,
      image: "https://via.placeholder.com/300x200?text=Smartphone",
      stock: 20
    },
    {
      id: 2,
      name: "Headphones",
      description: "Wireless headphones",
      price: 1499,
      image: "https://via.placeholder.com/300x200?text=Headphones",
      stock: 30
    },
    {
      id: 3,
      name: "Smart Watch",
      description: "Fitness smart watch",
      price: 2499,
      image: "https://via.placeholder.com/300x200?text=Smart+Watch",
      stock: 15
    }
  ],
  orders: []
};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    console.log("Starting with fresh data");
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const sessions = new Map();

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  const userId = token ? sessions.get(token) : null;
  const user = data.users.find(u => u.id === userId);

  if (!user) {
    return res.status(401).json({ error: "Login required" });
  }

  req.user = user;
  next();
}

function admin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "Byenext"
  });
});

app.get("/api/products", (req, res) => {
  res.json(data.products);
});

app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Name, email and password are required"
    });
  }

  if (data.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({
      error: "Email already registered"
    });
  }

  const user = {
    id: Date.now(),
    name,
    email,
    password,
    role: "customer"
  };

  data.users.push(user);
  saveData();

  const token = makeToken();
  sessions.set(token, user.id);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const user = data.users.find(
    u =>
      u.email.toLowerCase() === String(email || "").toLowerCase() &&
      u.password === password
  );

  if (!user) {
    return res.status(401).json({
      error: "Invalid email or password"
    });
  }

  const token = makeToken();
  sessions.set(token, user.id);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

app.get("/api/orders", auth, (req, res) => {
  if (req.user.role === "admin") {
    return res.json(data.orders);
  }

  res.json(
    data.orders.filter(o => o.userId === req.user.id)
  );
});

app.post("/api/orders", auth, (req, res) => {
  const { items, address } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: "Cart is empty"
    });
  }

  if (!address) {
    return res.status(400).json({
      error: "Delivery address is required"
    });
  }

  let subtotal = 0;

  const orderItems = [];

  for (const item of items) {
    const product = data.products.find(p => p.id === Number(item.id));

    if (!product) {
      return res.status(400).json({
        error: "Product not found"
      });
    }

    const qty = Number(item.qty);

    if (!qty || qty < 1) {
      return res.status(400).json({
        error: "Invalid quantity"
      });
    }

    if (product.stock < qty) {
      return res.status(400).json({
        error: `${product.name} is out of stock`
      });
    }

    subtotal += product.price * qty;

    orderItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty
    });

    product.stock -= qty;
  }

  const serviceFee = Math.round(subtotal * 0.01 * 100) / 100;
  const total = Math.round((subtotal + serviceFee) * 100) / 100;

  const order = {
    id: data.orders.length
      ? Math.max(...data.orders.map(o => o.id)) + 1
      : 1,
    userId: req.user.id,
    customer: req.user.name,
    items: orderItems,
    address,
    subtotal,
    serviceFee,
    total,
    status: "Pending",
    createdAt: new Date().toISOString()
  };

  data.orders.push(order);
  saveData();

  res.json({
    orderId: order.id,
    serviceFee,
    total
  });
});

app.put("/api/orders/:id", auth, admin, (req, res) => {
  const
