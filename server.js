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
      password: "Ankush@2009",
      role: "admin"
    }
  ],

  products: [
    {
      id: 1,
      name: "Smart watch",
      description: "Latest smartphone",
      price: 999,
      image: "https://via.placeholder.com/300x200?text=Smartphone",
      stock: 20,
      sellerId: null
    },
    {
      id: 2,
      name: "Headphones",
      description: "Wireless headphones",
      price: 1499,
      image: "https://via.placeholder.com/300x200?text=Headphones",
      stock: 30,
      sellerId: null
    },
    {
      id: 3,
      name: "Smart Watch",
      description: "Fitness smart watch",
      price: 2499,
      image: "https://via.placeholder.com/300x200?text=Smart+Watch",
      stock: 15,
      sellerId: null
    }
  ],

  orders: []
};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.log("Starting with fresh data");
  }
}

if (!Array.isArray(data.users)) data.users = [];
if (!Array.isArray(data.products)) data.products = [];
if (!Array.isArray(data.orders)) data.orders = [];

let adminUser = data.users.find(u => u.role === "admin");

if (adminUser) {
  adminUser.email = "admin@byenext.com";
  adminUser.password = "Ankush@2009";
} else {
  data.users.unshift({
    id: 1,
    name: "Admin",
    email: "admin@byenext.com",
    password: "Ankush@2009",
    role: "admin"
  });
}

data.products = data.products.map(product => ({
  ...product,
  sellerId: product.sellerId ?? null
}));

function saveData() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );
}

const sessions = new Map();

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";

  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  const userId = token
    ? sessions.get(token)
    : null;

  const user = data.users.find(
    u => u.id === userId
  );

  if (!user) {
    return res.status(401).json({
      error: "Login required"
    });
  }

  req.user = user;
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      error: "Admin access required"
    });
  }

  next();
}

function sellerOnly(req, res, next) {
  if (req.user.role !== "seller") {
    return res.status(403).json({
      error: "Seller access required"
    });
  }

  next();
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
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
  const {
    name,
    email,
    password,
    role
  } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Name, email and password are required"
    });
  }

  const cleanEmail = String(email)
    .trim()
    .toLowerCase();

  if (
    data.users.some(
      u => u.email.toLowerCase() === cleanEmail
    )
  ) {
    return res.status(400).json({
      error: "Email already registered"
    });
  }

  const userRole =
    role === "seller"
      ? "seller"
      : "customer";

  const user = {
    id: Date.now(),
    name: String(name).trim(),
    email: cleanEmail,
    password: String(password),
    role: userRole
  };

  data.users.push(user);
  saveData();

  const token = createToken();
  sessions.set(token, user.id);

  res.json({
    token,
    user: safeUser(user)
  });
});

app.post("/api/login", (req, res) => {
  const {
    email,
    password
  } = req.body;

  const cleanEmail = String(email || "")
    .trim()
    .toLowerCase();

  const user = data.users.find(
    u =>
      u.email.toLowerCase() === cleanEmail &&
      u.password === password
  );

  if (!user) {
    return res.status(401).json({
      error: "Invalid email or password"
    });
  }

  const token = createToken();
  sessions.set(token, user.id);

  res.json({
    token,
    user: safeUser(user)
  });
});

/* CUSTOMER ORDERS */

app.get("/api/orders", auth, (req, res) => {
  if (req.user.role === "admin") {
    return res.json(data.orders);
  }

  if (req.user.role === "seller") {
    const sellerOrders = data.orders
      .map(order => {
        const items = order.items.filter(
          item =>
            item.sellerId === req.user.id
        );

        if (items.length === 0) {
          return null;
        }

        const sellerSubtotal = items.reduce(
          (sum, item) =>
            sum + item.price * item.qty,
          0
        );

        return {
          ...order,
          items,
          sellerSubtotal
        };
      })
      .filter(Boolean);

    return res.json(sellerOrders);
  }

  res.json(
    data.orders.filter(
      order =>
        order.userId === req.user.id
    )
  );
});

/* SELLER PRODUCTS */

app.get(
  "/api/seller/products",
  auth,
  sellerOnly,
  (req, res) => {
    res.json(
      data.products.filter(
        product =>
          product.sellerId === req.user.id
      )
    );
  }
);

app.post(
  "/api/seller/products",
  auth,
  sellerOnly,
  (req, res) => {
    const {
      name,
      description,
      price,
      image,
      stock
    } = req.body;

    if (
      !name ||
      price === undefined ||
      stock === undefined
    ) {
      return res.status(400).json({
        error:
          "Name, price and stock are required"
      });
    }

    const productPrice = Number(price);
    const productStock = Number(stock);

    if (
      !Number.isFinite(productPrice) ||
      productPrice < 0
    ) {
      return res.status(400).json({
        error: "Invalid price"
      });
    }

    if (
      !Number.isInteger(productStock) ||
      productStock < 0
    ) {
      return res.status(400).json({
        error: "Invalid stock"
      });
    }

    const product = {
      id: Date.now(),
      name: String(name).trim(),
      description:
        String(description || "").trim(),
      price: productPrice,
      image:
        String(image || "").trim() ||
        "https://via.placeholder.com/300x200?text=Byenext",
      stock: productStock,
      sellerId: req.user.id
    };

    data.products.push(product);
    saveData();

    res.json(product);
  }
);

app.put(
  "/api/seller/products/:id",
  auth,
  sellerOnly,
  (req, res) => {
    const id = Number(req.params.id);

    const product = data.products.find(
      p =>
        p.id === id &&
        p.sellerId === req.user.id
    );

    if (!product) {
      return res.status(404).json({
        error: "Product not found"
      });
    }

    if (req.body.name !== undefined) {
      product.name =
        String(req.body.name).trim();
    }

    if (req.body.description !== undefined) {
      product.description =
        String(req.body.description).trim();
    }

    if (req.body.image !== undefined) {
      product.image =
        String(req.body.image).trim();
    }

    if (req.body.price !== undefined) {
      const price = Number(req.body.price);

      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({
          error: "Invalid price"
        });
      }

      product.price = price;
    }

    if (req.body.stock !== undefined) {
      const stock = Number(req.body.stock);

      if (!Number.isInteger(stock) || stock < 0) {
        return res.status(400).json({
          error: "Invalid stock"
        });
      }

      product.stock = stock;
    }

    saveData();

    res.json(product);
  }
);

app.delete(
  "/api/seller/products/:id",
  auth,
  sellerOnly,
  (req, res) => {
    const id = Number(req.params.id);

    const index = data.products.findIndex(
      product =>
        product.id === id &&
        product.sellerId === req.user.id
    );

    if (index === -1) {
      return res.status(404).json({
        error: "Product not found"
      });
    }

    data.products.splice(index, 1);
    saveData();

    res.json({
      ok: true
    });
  }
);

/* ADMIN PRODUCTS */

app.post(
  "/api/admin/products",
  auth,
  adminOnly,
  (req, res) => {
    const {
      name,
      description,
      price,
      image,
      stock
    } = req.body;

    if (
      !name ||
      price === undefined ||
      stock === undefined
    ) {
      return res.status(400).json({
        error:
          "Name, price and stock are required"
      });
    }

    const productPrice = Number(price);
    const productStock = Number(stock);

    if (
      !Number.isFinite(productPrice) ||
      productPrice < 0
    ) {
      return res.status(400).json({
        error: "Invalid price"
      });
    }

    if (
      !Number.isInteger(productStock) ||
      productStock < 0
    ) {
      return res.status(400).json({
        error: "Invalid stock"
      });
    }

    const product = {
      id: Date.now(),
      name: String(name).trim(),
      description:
        String(description || "").trim(),
      price: productPrice,
      image:
        String(image || "").trim() ||
        "https://via.placeholder.com/300x200?text=Byenext",
      stock: productStock,
      sellerId: null
    };

    data.products.push(product);
    saveData();

    res.json(product);
  }
);

app.delete(
  "/api/admin/products/:id",
  auth,
  adminOnly,
  (req, res) => {
    const id = Number(req.params.id);

    const index = data.products.findIndex(
      product => product.id === id
    );

    if (index === -1) {
      return res.status(404).json({
        error: "Product not found"
      });
    }

    data.products.splice(index, 1);
    saveData();

    res.json({
      ok: true
    });
  }
);

/* CREATE ORDER */

app.post("/api/orders", auth, (req, res) => {
  const {
    items,
    address
  } = req.body;

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
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
    const product = data.products.find(
      p => p.id === Number(item.id)
    );

    if (!product) {
      return res.status(400).json({
        error: "Product not found"
      });
    }

    const qty = Number(item.qty);

    if (!Number.isInteger(qty) || qty < 1) {
      return res.status(400).json({
        error: "Invalid quantity"
      });
    }

    if (product.stock < qty) {
      return res.status(400).json({
        error:
          product.name +
          " is out of stock"
      });
    }

    subtotal += product.price * qty;

    orderItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty: qty,
      sellerId:
        product.sellerId ?? null
    });

    product.stock -= qty;
  }

  const serviceFee =
    Math.round(
      subtotal * 0.01 * 100
    ) / 100;

  const total =
    Math.round(
      (subtotal + serviceFee) * 100
    ) / 100;

  const lastId =
    data.orders.length > 0
      ? Math.max(
          ...data.orders.map(
            order => order.id
          )
        )
      : 0;

  const order = {
    id: lastId + 1,
    userId: req.user.id,
    customer: req.user.name,
    items: orderItems,
    address: address,
    subtotal: subtotal,
    serviceFee: serviceFee,
    total: total,
    status: "Pending",
    createdAt:
      new Date().toISOString()
  };

  data.orders.push(order);
  saveData();

  res.json({
    orderId: order.id,
    serviceFee: serviceFee,
    total: total
  });
});

/* ADMIN ORDER STATUS */

app.put(
  "/api/orders/:id",
  auth,
  adminOnly,
  (req, res) => {
    const id = Number(req.params.id);

    const order = data.orders.find(
      o => o.id === id
    );

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    if (!req.body.status) {
      return res.status(400).json({
        error: "Status is required"
      });
    }

    order.status = req.body.status;

    saveData();

    res.json(order);
  }
);

app.use(
  express.static(__dirname)
);

app.listen(PORT, () => {
  console.log(
    `Byenext running on port ${PORT}`
  );
});
