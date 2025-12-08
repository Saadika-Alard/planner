import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import braintree from "braintree";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const PORT = process.env.PORT || 4000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase env vars. Check SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

// Supabase admin client for auth verification and privileged operations
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Braintree gateway (production keys should come from env)
const gateway = new braintree.BraintreeGateway({
  environment: process.env.BRAINTREE_ENV === "production"
    ? braintree.Environment.Production
    : braintree.Environment.Sandbox,
  merchantId: process.env.BRAINTREE_MERCHANT_ID || "YOUR_MERCHANT_ID",
  publicKey: process.env.BRAINTREE_PUBLIC_KEY || "YOUR_PUBLIC_KEY",
  privateKey: process.env.BRAINTREE_PRIVATE_KEY || "YOUR_PRIVATE_KEY"
});

// Plan configuration – central place for pricing & entitlements
const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    storageLimitMb: 500,
    maxChildren: 2,
    childViewEnabled: false
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 9,
    storageLimitMb: 5000,
    maxChildren: 5,
    childViewEnabled: true
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 18,
    storageLimitMb: 20000,
    maxChildren: 10,
    childViewEnabled: true
  }
};

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:3000"],
  credentials: true
}));
app.use(express.json());
app.use(morgan("tiny"));

// Auth middleware: verifies Supabase access token and attaches user
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: "Missing bearer token" });
    }
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    req.user = {
      id: data.user.id,
      email: data.user.email,
      token
    };
    next();
  } catch (err) {
    console.error("authMiddleware error", err);
    return res.status(500).json({ error: "Auth check failed" });
  }
}

// Creates a Supabase client that uses the user's token so RLS still applies
function getUserSupabase(req) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${req.user.token}`
      }
    }
  });
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Fetch or create profile with plan info
app.get("/api/profile", authMiddleware, async (req, res) => {
  const supa = getUserSupabase(req);
  const userId = req.user.id;
  const { data, error } = await supa
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("profile fetch error", error);
    return res.status(500).json({ error: "Failed to load profile" });
  }

  if (!data) {
    const { data: inserted, error: insertErr } = await supa
      .from("profiles")
      .insert({ id: userId, plan: "free" })
      .select("*")
      .single();
    if (insertErr) {
      console.error("profile insert error", insertErr);
      return res.status(500).json({ error: "Failed to create profile" });
    }
    return res.json(inserted);
  }

  return res.json(data);
});

// Return Braintree client token for frontend to initialize Braintree UI
app.post("/api/billing/client-token", authMiddleware, async (req, res) => {
  try {
    const { customerId } = req.body || {};
    const result = await gateway.clientToken.generate({
      customerId: customerId || undefined
    });
    return res.json({ clientToken: result.clientToken });
  } catch (err) {
    console.error("braintree client token error", err);
    return res.status(500).json({ error: "Failed to generate client token" });
  }
});

// Subscribe or change plan
app.post("/api/billing/subscribe", authMiddleware, async (req, res) => {
  const { planId, paymentMethodNonce } = req.body || {};
  const userId = req.user.id;

  if (!planId || !PLANS[planId]) {
    return res.status(400).json({ error: "Unknown plan" });
  }
  if (!paymentMethodNonce) {
    return res.status(400).json({ error: "Missing payment method" });
  }

  const plan = PLANS[planId];

  try {
    // Create or update a Braintree customer and subscription.
    // This is intentionally simplified; you can extend with real subscriptions.
    const saleResult = await gateway.transaction.sale({
      amount: plan.priceMonthly.toFixed(2),
      paymentMethodNonce,
      options: { submitForSettlement: true }
    });

    if (!saleResult.success) {
      console.error("braintree sale error", saleResult);
      return res.status(400).json({ error: "Payment failed" });
    }

    const supa = getUserSupabase(req);
    const { data, error } = await supa
      .from("profiles")
      .update({
        plan: plan.id,
        storage_limit_mb: plan.storageLimitMb,
        child_view_enabled: plan.childViewEnabled
      })
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      console.error("profile plan update error", error);
      return res.status(500).json({ error: "Payment succeeded but profile update failed" });
    }

    return res.json({ success: true, profile: data });
  } catch (err) {
    console.error("billing subscribe error", err);
    return res.status(500).json({ error: "Unexpected billing error" });
  }
});

// Securely verify parent PIN without exposing it to client
app.post("/api/auth/verify-pin", authMiddleware, async (req, res) => {
  const { pin } = req.body;
  const userId = req.user.id;

  if (!pin) {
    return res.status(400).json({ error: "PIN required" });
  }

  const supa = getUserSupabase(req);
  // We explicitly select ONLY the parent_pin here to verify
  const { data, error } = await supa
    .from("profiles")
    .select("parent_pin")
    .eq("id", userId)
    .single();

  if (error || !data) {
    console.error("PIN verification error", error);
    return res.status(500).json({ error: "Failed to verify PIN" });
  }

  // Check if PIN matches
  if (data.parent_pin === pin) {
    return res.json({ success: true });
  } else {
    return res.json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log(`Planner backend listening on http://localhost:${PORT}`);
});

