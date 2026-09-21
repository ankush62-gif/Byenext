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
  } catch (e) {
    console.log("Starting with fresh data");
  }
}

if (!Array.isArray(data.users)) data.users = [];
if (!Array.isArray(data.products)) data.products = [];
if (!Array.isArray(data.orders)) data.orders = [];
if (!Array.isArray(data.payments)) data.payments = [];
const adminUser = data.users.find(u => u.role === "admin");

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

data.products = data.products.map(p => ({
  ...p,
  sellerId: p.sellerId ?? null
}));

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const sessions = new Map();

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";

  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  const userId = token ? sessions.get(token) : null;
  const user = data.users.find(u => u.id === userId);

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

function adminOrSeller(req, res, next) {
  if (
    req.user.role !== "admin" &&
    req.user.role !== "seller"
  ) {
    return res.status(403).json({
      error: "Seller or admin access required"
    });
  }

  next();
}


/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "Byenext"
  });
});


/* =========================
   PRODUCTS
========================= */

app.get("/api/products", (req, res) => {
  res.json(data.products);
});


/* =========================
   CUSTOMER REGISTER
========================= */

app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Name, email and password are required"
    });
  }

  const cleanEmail = String(email).trim().toLowerCase();

  if (
    data.users.some(
      u => u.email.toLowerCase() === cleanEmail
    )
  ) {
    return res.status(400).json({
      error: "Email already registered"
    });
  }

  const user = {
    id: Date.now(),
    name: String(name).trim(),
    email: cleanEmail,
    password: String(password),
    role: "customer"
  };

  data.users.push(user);
  saveData();

  const token = makeToken();
  sessions.set(token, user.id);

  res.json({
    token,
    user: safeUser(user)
  });
});


/* =========================
   SELLER REGISTER
========================= */

app.post("/api/register-seller", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Name, email and password are required"
    });
  }

  const cleanEmail = String(email).trim().toLowerCase();

  if (
    data.users.some(
      u => u.email.toLowerCase() === cleanEmail
    )
  ) {
    return res.status(400).json({
      error: "Email already registered"
    });
  }

  const seller = {
    id: Date.now(),
    name: String(name).trim(),
    email: cleanEmail,
    password: String(password),
    role: "seller"
  };

  data.users.push(seller);
  saveData();

  const token = makeToken();
  sessions.set(token, seller.id);

  res.json({
    token,
    user: safeUser(seller)
  });
});


/* =========================
   LOGIN
========================= */

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

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

  const token = makeToken();
  sessions.set(token, user.id);

  res.json({
    token,
    user: safeUser(user)
  });
});


/* =========================
   SELLER PRODUCTS
========================= */

app.get(
  "/api/seller/products",
  auth,
  sellerOnly,
  (req, res) => {
    res.json(
      data.products.filter(
        p => p.sellerId === req.user.id
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
        error: "Name, price and stock are required"
      });
    }

    const product = {
      id: Date.now(),
      name: String(name).trim(),
      description: String(description || "").trim(),
      price: Number(price),
      image:
        String(image || "").trim() ||
        "https://via.placeholder.com/300x200?text=Byenext",
      stock: Number(stock),
      sellerId: req.user.id
    };

    if (
      !Number.isFinite(product.price) ||
      product.price < 0
    ) {
      return res.status(400).json({
        error: "Invalid price"
      });
    }

    if (
      !Number.isInteger(product.stock) ||
      product.stock < 0
    ) {
      return res.status(400).json({
        error: "Invalid stock"
      });
    }

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

    const {
      name,
      description,
      price,
      image,
      stock
    } = req.body;

    if (name !== undefined) {
      product.name = String(name).trim();
    }

    if (description !== undefined) {
      product.description =
        String(description).trim();
    }

    if (price !== undefined) {
      const newPrice = Number(price);

      if (
        !Number.isFinite(newPrice) ||
        newPrice < 0
      ) {
        return res.status(400).json({
          error: "Invalid price"
        });
      }

      product.price = newPrice;
    }

    if (stock !== undefined) {
      const newStock = Number(stock);

      if (
        !Number.isInteger(newStock) ||
        newStock < 0
      ) {
        return res.status(400).json({
          error: "Invalid stock"
        });
      }

      product.stock = newStock;
    }

    if (image !== undefined) {
      product.image = String(image).trim();
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
      p =>
        p.id === id &&
        p.sellerId === req.user.id
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


/* =========================
   ADMIN PRODUCTS
========================= */

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
        error: "Name, price and stock are required"
      });
    }

    const product = {
      id: Date.now(),
      name: String(name).trim(),
      description: String(description || "").trim(),
      price: Number(price),
      image:
        String(image || "").trim() ||
        "https://via.placeholder.com/300x200?text=Byenext",
      stock: Number(stock),
      sellerId: null
    };

    if (
      !Number.isFinite(product.price) ||
      product.price < 0
    ) {
      return res.status(400).json({
        error: "Invalid price"
      });
    }

    if (
      !Number.isInteger(product.stock) ||
      product.stock < 0
    ) {
      return res.status(400).json({
        error: "Invalid stock"
      });
    }

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
      p => p.id === id
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


/* =========================
   ORDERS
========================= */

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

        const sellerSubtotal =
          items.reduce(
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


/* =========================
   CREATE ORDER
========================= */

app.post("/api/orders", auth, (req, res) => {
  const { items, address } = req.body;

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

    if (
      !Number.isInteger(qty) ||
      qty < 1
    ) {
      return res.status(400).json({
        error: "Invalid quantity"
      });
    }

    if (product.stock < qty) {
      return res.status(400).json({
        error:
          `${product.name} is out of stock`
      });
    }

    subtotal += product.price * qty;

    orderItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty,
      sellerId: product.sellerId ?? null
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

  const order = {
    id:
      data.orders.length
        ? Math.max(
            ...data.orders.map(
              o => o.id
            )
          ) + 1
        : 1,

    userId: req.user.id,

    customer: req.user.name,

    items: orderItems,

    address,

    subtotal,

    serviceFee,

    total,

    status: "Pending",

    createdAt:
      new Date().toISOString()
  };

  data.orders.push(order);

  saveData();

  res.json({
    orderId: order.id,
    serviceFee,
    total
  });
});

/* =========================
   RAZORPAY PAYMENT
========================= */

function razorpayAuth() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay keys are not configured");
  }

  return {
    keyId,
    auth: Buffer.from(`${keyId}:${keySecret}`).toString("base64")
  };
}

function calculatePaymentCart(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error("Cart is empty");
  }

  let subtotal = 0;
  const orderItems = [];

  for (const item of items) {
    const product = data.products.find(
      p => p.id === Number(item.id)
    );

    if (!product) {
      throw new Error("Product not found");
    }

    const qty = Number(item.qty);

    if (!Number.isInteger(qty) || qty < 1) {
      throw new Error("Invalid quantity");
    }

    if (product.stock < qty) {
      throw new Error(`${product.name} is out of stock`);
    }

    subtotal += product.price * qty;

    orderItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty,
      sellerId: product.sellerId || null
    });
  }

  const serviceFee =
    Math.round(subtotal * 0.01 * 100) / 100;

  const total =
    Math.round((subtotal + serviceFee) * 100) / 100;

  return {
    subtotal,
    serviceFee,
    total,
    orderItems
  };
}


/* CREATE RAZORPAY ORDER */

app.post(
  "/api/payment/create",
  auth,
  async (req, res) => {
    try {
      const { items, address } = req.body;

      if (!address) {
        return res.status(400).json({
          error: "Delivery address is required"
        });
      }

      const calc = calculatePaymentCart(items);

      const {
        keyId,
        auth: authHeader
      } = razorpayAuth();

      const razorpayResponse = await fetch(
        "https://api.razorpay.com/v1/orders",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Basic " + authHeader
          },
          body: JSON.stringify({
            amount: Math.round(calc.total * 100),
            currency: "INR",
            receipt: `byenext_${Date.now()}`,
            notes: {
              userId: String(req.user.id)
            }
          })
        }
      );

      const razorpayOrder =
        await razorpayResponse.json();

      if (!razorpayResponse.ok) {
        return res.status(502).json({
          error:
            razorpayOrder.error?.description ||
            "Razorpay order creation failed"
        });
      }

      if (!Array.isArray(data.payments)) {
        data.payments = [];
      }

      data.payments.push({
        razorpayOrderId: razorpayOrder.id,
        userId: req.user.id,
        address: String(address),
        items: items.map(item => ({
          id: Number(item.id),
          qty: Number(item.qty)
        })),
        total: calc.total,
        subtotal: calc.subtotal,
        serviceFee: calc.serviceFee,
        status: "created",
        createdAt: new Date().toISOString()
      });

      saveData();

      res.json({
        keyId,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        total: calc.total,
        serviceFee: calc.serviceFee
      });

    } catch (e) {
      res.status(500).json({
        error: e.message
      });
    }
  }
);


/* VERIFY RAZORPAY PAYMENT */

app.post(
  "/api/payment/verify",
  auth,
  async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      } = req.body;

      const paymentRecord =
        data.payments.find(
          p =>
            p.razorpayOrderId === razorpay_order_id &&
            p.userId === req.user.id
        );

      if (!paymentRecord) {
        return res.status(404).json({
          error: "Payment order not found"
        });
      }

      if (paymentRecord.status === "paid") {
        return res.json({
          ok: true,
          orderId: paymentRecord.localOrderId,
          total: paymentRecord.total
        });
      }

      const secret =
        process.env.RAZORPAY_KEY_SECRET;

      const expectedSignature =
        crypto
          .createHmac("sha256", secret)
          .update(
            `${razorpay_order_id}|${razorpay_payment_id}`
          )
          .digest("hex");

      if (
        expectedSignature !==
        razorpay_signature
      ) {
        return res.status(400).json({
          error: "Payment signature verification failed"
        });
      }

      const {
        auth: authHeader
      } = razorpayAuth();

      const paymentResponse =
        await fetch(
          `https://api.razorpay.com/v1/payments/${encodeURIComponent(
            razorpay_payment_id
          )}`,
          {
            headers: {
              "Authorization":
                "Basic " + authHeader
            }
          }
        );

      const payment =
        await paymentResponse.json();

      if (
        !paymentResponse.ok ||
        payment.order_id !== razorpay_order_id ||
        payment.status !== "captured"
      ) {
        return res.status(400).json({
          error: "Payment is not captured"
        });
      }

      if (
        Number(payment.amount) !==
        Math.round(paymentRecord.total * 100)
      ) {
        return res.status(400).json({
          error: "Payment amount mismatch"
        });
      }

      const calc =
        calculatePaymentCart(
          paymentRecord.items
        );

      const orderId =
        data.orders.length
          ? Math.max(
              ...data.orders.map(o => o.id)
            ) + 1
          : 1;

      for (const item of calc.orderItems) {
        const product =
          data.products.find(
            p => p.id === item.productId
          );

        product.stock -= item.qty;
      }

      const order = {
        id: orderId,
        userId: req.user.id,
        customer: req.user.name,
        items: calc.orderItems,
        address: paymentRecord.address,
        subtotal: calc.subtotal,
        serviceFee: calc.serviceFee,
        total: calc.total,
        status: "Pending",
        paymentStatus: "Paid",
        paymentProvider: "Razorpay",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        createdAt: new Date().toISOString()
      };

      data.orders.push(order);

      paymentRecord.status = "paid";
      paymentRecord.localOrderId = orderId;
      paymentRecord.paymentId =
        razorpay_payment_id;

      saveData();

      res.json({
        ok: true,
        orderId: orderId,
        total: order.total
      });

    } catch (e) {
      res.status(500).json({
        error: e.message
      });
    }
  }
);
/* =========================
   UPDATE ORDER STATUS
========================= */

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

    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        error: "Status is required"
      });
    }

    order.status = status;

    saveData();

    res.json(order);
  }
);


/* =========================
   STATIC WEBSITE
========================= */

app.use(
  express.static(
    path.join(__dirname)
  )
);


/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(
    `Byenext running on port ${PORT}`
  );
});
