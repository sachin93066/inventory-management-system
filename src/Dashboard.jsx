import ActivityLog from "./ActivityLog";
import StaffManagement from "./StaffManagement";
import StockMovementAnalytics from "./StockMovementAnalytics";
import InventoryAnalytics from "./InventoryAnalytics";
import CategoryManagement from "./CategoryManagement";
import { apiFetch } from "./api";
import { useState, useEffect } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:5000/api/products";
const MOVEMENTS_URL = "http://127.0.0.1:5000/api/stock-movements";

function Dashboard({ user, onLogout }) {
  const isAdmin =
    String(user?.role || "").toLowerCase() === "admin";

  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [restockProduct, setRestockProduct] = useState(null);
  const [restockQuantity, setRestockQuantity] = useState("");
  const [restocking, setRestocking] = useState(false);

  const [stockMovements, setStockMovements] = useState([]);
  const [movementLoading, setMovementLoading] = useState(true);
  const [movementError, setMovementError] = useState("");
  const [movementFilter, setMovementFilter] = useState("All");
  const [movementSearch, setMovementSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportingLowStock, setExportingLowStock] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    price: "",
    quantity: "",
    min_stock: "5",
  });

  async function fetchProducts() {
    try {
      setError("");

      const response = await apiFetch(API_URL);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load products.");
      }

      setProducts(Array.isArray(data) ? data : []);
      return true;
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to the backend. Please check that the server is running."
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function fetchStockMovements() {
    setMovementLoading(true);

    try {
      setMovementError("");

      const response = await apiFetch(MOVEMENTS_URL);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load stock movement history."
        );
      }

      setStockMovements(Array.isArray(data) ? data : []);
      return true;
    } catch (err) {
      setMovementError(
        err.message || "Unable to load stock movement history."
      );
      return false;
    } finally {
      setMovementLoading(false);
    }
  }

  async function refreshDashboard() {
    if (refreshing) return;

    setRefreshing(true);

    try {
      const results = await Promise.all([
        fetchProducts(),
        fetchStockMovements(),
      ]);

      if (results.every(Boolean)) {
        setLastUpdated(new Date());
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRefreshDashboard() {
    setError("");
    setMessage("");
    await refreshDashboard();
  }

  useEffect(() => {
    refreshDashboard();
  }, []);

  const categories = [
    "All",
    ...new Set(
      products
        .map((product) => product.category)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
    ),
  ];

  const filteredProducts = products.filter((product) => {
    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      String(product.name || "").toLowerCase().includes(search) ||
      String(product.sku || "").toLowerCase().includes(search);

    const matchesCategory =
      selectedCategory === "All" ||
      product.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const filteredMovements = stockMovements.filter((movement) => {
    const search = movementSearch.trim().toLowerCase();

    const matchesSearch = String(movement.product_name || "")
      .toLowerCase()
      .includes(search);

    const matchesType =
      movementFilter === "All" ||
      movement.movement_type === movementFilter;

    const movementDate = movement.created_at
      ? String(movement.created_at).slice(0, 10)
      : "";

    const matchesStartDate =
      !startDate || (movementDate && movementDate >= startDate);

    const matchesEndDate =
      !endDate || (movementDate && movementDate <= endDate);

    return (
      matchesSearch &&
      matchesType &&
      matchesStartDate &&
      matchesEndDate
    );
  });

  function clearMovementFilters() {
    setMovementSearch("");
    setMovementFilter("All");
    setStartDate("");
    setEndDate("");
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function resetForm() {
    setFormData({
      name: "",
      sku: "",
      category: "",
      price: "",
      quantity: "",
      min_stock: "5",
    });

    setEditingId(null);
  }

  function openAddForm() {
    if (!isAdmin) return;

    resetForm();
    setRestockProduct(null);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!isAdmin) {
      setError("Only administrators can add or edit products.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(
        editingId ? `${API_URL}/${editingId}` : API_URL,
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify({
            ...formData,
            price: Number(formData.price),
            quantity: Number(formData.quantity),
            min_stock: Number(formData.min_stock),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save the product.");
      }

      const wasEditing = Boolean(editingId);

      resetForm();
      setShowForm(false);

      setMessage(
        wasEditing
          ? "Product updated successfully."
          : "Product added successfully."
      );

      await refreshDashboard();
    } catch (err) {
      setError(
        err.message || "An error occurred while saving the product."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(product) {
    if (!isAdmin) return;

    setRestockProduct(null);

    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: String(product.price),
      quantity: String(product.quantity),
      min_stock: String(product.min_stock),
    });

    setEditingId(product.id);
    setShowForm(true);
    setError("");
    setMessage("");

    document.getElementById("products")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleDelete(id) {
    if (!isAdmin) {
      setError("Only administrators can delete products.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this product?"
    );

    if (!confirmed) return;

    setDeletingId(id);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(`${API_URL}/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to delete the product.");
      }

      if (editingId === id) {
        resetForm();
        setShowForm(false);
      }

      if (restockProduct?.id === id) {
        setRestockProduct(null);
        setRestockQuantity("");
      }

      setMessage("Product deleted successfully.");
      await refreshDashboard();
    } catch (err) {
      setError(
        err.message || "An error occurred while deleting the product."
      );
    } finally {
      setDeletingId(null);
    }
  }

  function openRestock(product) {
    setShowForm(false);
    resetForm();

    setRestockProduct(product);
    setRestockQuantity("");
    setError("");
    setMessage("");

    document.getElementById("stock")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleRestock(event) {
    event.preventDefault();

    if (!restockProduct) return;

    const amount = Number(restockQuantity);
    const currentQuantity = Number(restockProduct.quantity);
    const updatedQuantity = currentQuantity + amount;

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError("Please enter a whole number greater than zero.");
      return;
    }

    if (!Number.isSafeInteger(updatedQuantity)) {
      setError("The resulting stock quantity is too large.");
      return;
    }

    setRestocking(true);
    setError("");
    setMessage("");

    try {
      // Staff can change quantity only. Other product fields stay unchanged.
      const response = await apiFetch(
        `${API_URL}/${restockProduct.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: restockProduct.name,
            sku: restockProduct.sku,
            category: restockProduct.category,
            price: Number(restockProduct.price),
            quantity: updatedQuantity,
            min_stock: Number(restockProduct.min_stock),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to restock this product.");
      }

      const productName = restockProduct.name;

      setRestockProduct(null);
      setRestockQuantity("");

      setMessage(
        `${productName} restocked successfully. New quantity: ${updatedQuantity}.`
      );

      await refreshDashboard();
    } catch (err) {
      setError(err.message || "An error occurred while restocking.");
    } finally {
      setRestocking(false);
    }
  }

  const totalProducts = products.length;

  const totalUnits = products.reduce(
    (total, product) => total + Number(product.quantity || 0),
    0
  );

  const lowStock = products.filter((product) => {
    const quantity = Number(product.quantity);
    const minimum = Number(product.min_stock);

    return quantity > 0 && quantity <= minimum;
  }).length;

  const outOfStock = products.filter(
    (product) => Number(product.quantity) === 0
  ).length;

  const inventoryValue = products.reduce(
    (total, product) =>
      total +
      Number(product.price || 0) * Number(product.quantity || 0),
    0
  );

  function getStatus(product) {
    const quantity = Number(product.quantity);
    const minimum = Number(product.min_stock);

    if (quantity <= 0) {
      return { label: "Out of Stock", className: "out-stock" };
    }

    if (quantity <= minimum) {
      return { label: "Low Stock", className: "low-stock" };
    }

    return { label: "In Stock", className: "in-stock" };
  }

  const stockAlerts = products
    .filter(
      (product) =>
        Number(product.quantity) <= Number(product.min_stock)
    )
    .sort((a, b) => Number(a.quantity) - Number(b.quantity));

  const currency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);

  function formatDateTime(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function escapeCSV(value) {
    const text = String(value ?? "").replace(/"/g, '""');
    return `"${text}"`;
  }

  function downloadCSV(headers, rows, filename) {
    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportStockHistory() {
    if (movementLoading) {
      setMessage("Please wait until stock history finishes loading.");
      return;
    }

    if (movementError) {
      setError("Unable to export history because it could not be loaded.");
      return;
    }

    if (filteredMovements.length === 0) {
      setMessage("No stock history available to export.");
      return;
    }

    setExporting(true);
    setError("");
    setMessage("");

    try {
      const headers = [
        "Date & Time",
        "Product",
        "Movement",
        "Quantity Changed",
        "Previous Stock",
        "New Stock",
        "Notes",
      ];

      const rows = filteredMovements.map((movement) => [
        movement.created_at || "",
        movement.product_name || "",
        movement.movement_type || "",
        movement.quantity ?? 0,
        movement.previous_quantity ?? 0,
        movement.new_quantity ?? 0,
        movement.notes || "",
      ]);

      downloadCSV(headers, rows, "stock-movement-history.csv");

      setMessage(
        `CSV export started successfully. ${filteredMovements.length} records included.`
      );
    } catch (err) {
      setError(err.message || "Unable to export stock movement history.");
    } finally {
      setExporting(false);
    }
  }

  function exportLowStockReport() {
    if (loading) {
      setMessage("Please wait until products finish loading.");
      return;
    }

    if (stockAlerts.length === 0) {
      setMessage("No low-stock or out-of-stock products to export.");
      return;
    }

    setExportingLowStock(true);
    setError("");
    setMessage("");

    try {
      const headers = [
        "Product ID",
        "Product Name",
        "SKU",
        "Category",
        "Price (INR)",
        "Current Quantity",
        "Minimum Stock",
        "Restock Quantity Needed",
        "Status",
      ];

      const rows = stockAlerts.map((product) => {
        const quantity = Number(product.quantity) || 0;
        const minimum = Number(product.min_stock) || 0;

        return [
          product.id,
          product.name || "",
          product.sku || "",
          product.category || "",
          Number(product.price) || 0,
          quantity,
          minimum,
          Math.max(minimum - quantity, 0),
          getStatus(product).label,
        ];
      });

      downloadCSV(headers, rows, "low-stock-report.csv");

      setMessage(
        `Low stock report exported successfully. ${stockAlerts.length} products included.`
      );
    } catch (err) {
      setError(err.message || "Unable to export the low stock report.");
    } finally {
      setExportingLowStock(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>
          Stock<span>Flow</span>
        </h2>

        <p className="menu-title">MAIN MENU</p>

        
        <nav>
            <a className="active" href="#dashboard">▦ Dashboard</a>
            <a href="#analytics">📈 Analytics</a>
            <a href="#products">📦 Products</a>

            {isAdmin && (
            <a href="#category-management">🗂 Categories</a>
            )}

            <a href="#stock">⚠ Stock Alerts</a>
            <a href="#movement-history">🔄 Stock Movement</a>
            <a href="#reports">📊 Reports</a>

            {isAdmin && (
            <>
            <p className="menu-title">ADMINISTRATION</p>
            <a href="#staff-management">👥 Create Staff Account</a>
            <a href="#activity-logs">📋 Activity Logs</a>
            </>
            )}
            </nav>


        <div className="sidebar-bottom">
          <p>Inventory Management</p>
          <small>Version 1.0</small>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back! Here's your inventory overview.</p>
          </div>

          <div className="profile">
            <div className="avatar">
              {(user?.name || user?.username || "U")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>{user?.name || user?.username || "User"}</strong>
              <small>
                {isAdmin ? "Administrator" : "Staff"}
              </small>
            </div>

            <button type="button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        <section
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
            padding: "16px 20px",
            marginBottom: "20px",
            background: "var(--card-bg, #ffffff)",
            border: "1px solid var(--border-color, #e5e7eb)",
            borderRadius: "12px",
          }}
        >
          <div>
            <strong style={{ display: "block", marginBottom: "5px" }}>
              Dashboard Data
            </strong>

            <small style={{ color: "var(--muted-color, #6b7280)" }}>
              Last updated:{" "}
              {lastUpdated
                ? formatDateTime(lastUpdated)
                : refreshing
                  ? "Loading data..."
                  : "Not updated yet"}
            </small>
          </div>

          <button
            type="button"
            onClick={handleRefreshDashboard}
            disabled={refreshing}
          >
            {refreshing ? "↻ Refreshing Dashboard..." : "↻ Refresh Dashboard"}
          </button>
        </section>

        <section className="welcome-banner">
          <div>
            <p>INVENTORY OVERVIEW</p>
            <h2>Manage your stock smarter.</h2>
            <span>
              {isAdmin
                ? "Manage products, categories and inventory."
                : "View products, update stock and track inventory."}
            </span>
          </div>

          <div className="banner-icon">📦</div>
        </section>

        {error && (
          <div className="notice error-notice" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="notice success-notice" role="status">
            {message}
          </div>
        )}

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon purple">📦</div>
            <p>Total Products</p>
            <h2>{loading ? "..." : totalProducts}</h2>
            <small>Products in your inventory</small>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">↗</div>
            <p>Total Stock Units</p>
            <h2>{loading ? "..." : totalUnits.toLocaleString("en-IN")}</h2>
            <small>Units currently in stock</small>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">⚠</div>
            <p>Low Stock Items</p>
            <h2>{loading ? "..." : lowStock}</h2>
            <small>Items that need restocking</small>
          </div>

          <div className="stat-card">
            <div className="stat-icon blue">₹</div>
            <p>Inventory Value</p>
            <h2>{loading ? "..." : currency(inventoryValue)}</h2>
            <small>Value based on current product prices</small>
          </div>
        </section>

        <div id="analytics">
          <InventoryAnalytics
            products={products}
            loading={loading}
            currency={currency}
          />

          <StockMovementAnalytics
            stockMovements={stockMovements}
            loading={movementLoading}
            error={movementError}
          />
        </div>

        <section className="products-section" id="products">
          <div className="section-heading">
            <div>
              <h2>Products Inventory</h2>
              <p>Products loaded from your MySQL database.</p>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  if (showForm) {
                    resetForm();
                    setShowForm(false);
                  } else {
                    openAddForm();
                  }

                  setMessage("");
                  setError("");
                }}
              >
                {showForm ? "Cancel" : "+ Add Product"}
              </button>
            )}
          </div>

          {isAdmin && showForm && (
            <form className="product-form" onSubmit={handleSubmit}>
              <h3>{editingId ? "Edit Product" : "Add New Product"}</h3>

              <div className="form-grid">
                <label>
                  Product Name
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Wireless Mouse"
                    required
                    maxLength={150}
                  />
                </label>

                <label>
                  SKU / Product Code
                  <input
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    placeholder="e.g. PRD-001"
                    required
                    maxLength={50}
                  />
                </label>

                <label>
                  Category
                  <input
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    placeholder="e.g. Electronics"
                    required
                    maxLength={100}
                  />
                </label>

                <label>
                  Price (₹)
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="799"
                    min="0"
                    step="0.01"
                    required
                  />
                </label>

                <label>
                  Quantity
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    placeholder="50"
                    min="0"
                    step="1"
                    required
                  />
                </label>

                <label>
                  Minimum Stock Alert
                  <input
                    type="number"
                    name="min_stock"
                    value={formData.min_stock}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    required
                  />
                </label>
              </div>

              <button className="save-button" type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Product"
                    : "Save Product"}
              </button>

              {editingId && (
                <button
                  className="cancel-edit-button"
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                    setError("");
                    setMessage("");
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </form>
          )}

          <div className="product-filters">
            <div className="search-box">
              <span aria-hidden="true">🔍</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by product name or SKU..."
                aria-label="Search products by name or SKU"
              />
            </div>

            <div className="category-filter">
              <label htmlFor="category-filter">Category:</label>
              <select
                id="category-filter"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {(searchTerm || selectedCategory !== "All") && (
              <button
                type="button"
                className="clear-filters-button"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("All");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {!loading && (
            <p className="results-count">
              Showing {filteredProducts.length} of {totalProducts} products
            </p>
          )}

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>SKU</th>
                  <th>CATEGORY</th>
                  <th>PRICE</th>
                  <th>QUANTITY</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7">Loading products...</td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      {isAdmin
                        ? 'No products available. Click "+ Add Product" to add one.'
                        : "No products are available."}
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      No products match your search or selected category.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const status = getStatus(product);

                    return (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>{product.sku}</td>
                        <td>{product.category}</td>
                        <td>{currency(Number(product.price))}</td>
                        <td>{product.quantity}</td>

                        <td>
                          <span className={`badge ${status.className}`}>
                            {status.label}
                          </span>
                        </td>

                        <td className="action-buttons">
                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                className="edit-button"
                                onClick={() => handleEdit(product)}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="delete-button"
                                onClick={() => handleDelete(product.id)}
                                disabled={deletingId === product.id}
                              >
                                {deletingId === product.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="edit-button"
                              onClick={() => openRestock(product)}
                            >
                              Update Stock
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="products-section" id="stock">
          <div className="section-heading">
            <div>
              <h2>Stock Alerts</h2>
              <p>Products that need your attention.</p>
            </div>

            <span className="badge low-stock">
              {loading ? "..." : stockAlerts.length} Alerts
            </span>
          </div>

          {restockProduct && (
            <form className="product-form" onSubmit={handleRestock}>
              <h3>Update Stock</h3>

              <p>
                Product: <strong>{restockProduct.name}</strong>
              </p>

              <p>
                SKU: <strong>{restockProduct.sku}</strong>
              </p>

              <p>
                Current Quantity: <strong>{restockProduct.quantity}</strong>
              </p>

              <label>
                Additional Quantity
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={restockQuantity}
                  onChange={(event) => setRestockQuantity(event.target.value)}
                  placeholder="Enter units to add"
                  required
                  disabled={restocking}
                />
              </label>

              <p>
                New Quantity:{" "}
                <strong>
                  {Number(restockProduct.quantity) +
                    (Number(restockQuantity) || 0)}
                </strong>
              </p>

              <button type="submit" disabled={restocking}>
                {restocking ? "Updating..." : "Confirm Stock Update"}
              </button>

              <button
                type="button"
                className="cancel-edit-button"
                onClick={() => {
                  setRestockProduct(null);
                  setRestockQuantity("");
                  setError("");
                }}
                disabled={restocking}
              >
                Cancel
              </button>
            </form>
          )}

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon orange">⚠</div>
              <p>Low Stock</p>
              <h2>{loading ? "..." : lowStock}</h2>
              <small>Products below or at minimum stock</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon purple">📦</div>
              <p>Out of Stock</p>
              <h2>{loading ? "..." : outOfStock}</h2>
              <small>Products with zero quantity</small>
            </div>
          </div>

          {loading ? (
            <p className="empty-state">Checking stock levels...</p>
          ) : stockAlerts.length === 0 ? (
            <div className="empty-state">
              <h3>All Stock Levels Are Healthy</h3>
              <p>No products currently require restocking.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>PRODUCT</th>
                    <th>SKU</th>
                    <th>CATEGORY</th>
                    <th>AVAILABLE</th>
                    <th>MINIMUM STOCK</th>
                    <th>STATUS</th>
                    <th>ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {stockAlerts.map((product) => {
                    const status = getStatus(product);

                    return (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>{product.sku}</td>
                        <td>{product.category}</td>
                        <td>{product.quantity}</td>
                        <td>{product.min_stock}</td>

                        <td>
                          <span className={`badge ${status.className}`}>
                            {status.label}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="edit-button"
                            onClick={() => openRestock(product)}
                          >
                            Update Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="products-section" id="movement-history">
          <div className="section-heading">
            <div>
              <h2>Stock Movement History</h2>
              <p>Track stock additions, reductions and quantity changes.</p>
            </div>

            <div className="movement-actions">
              <button
                type="button"
                onClick={exportStockHistory}
                disabled={movementLoading || exporting}
              >
                {exporting ? "Exporting..." : "↓ Export CSV"}
              </button>

              <button
                type="button"
                onClick={fetchStockMovements}
                disabled={movementLoading}
              >
                {movementLoading ? "Loading..." : "↻ Refresh History"}
              </button>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon purple">↔</div>
              <p>Total Movements</p>
              <h2>{movementLoading ? "..." : stockMovements.length}</h2>
              <small>Recent recorded stock changes</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon green">↗</div>
              <p>Stock In Entries</p>
              <h2>
                {movementLoading
                  ? "..."
                  : stockMovements.filter(
                      (item) => item.movement_type === "Stock In"
                    ).length}
              </h2>
              <small>Recorded stock increases</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">↘</div>
              <p>Stock Out Entries</p>
              <h2>
                {movementLoading
                  ? "..."
                  : stockMovements.filter(
                      (item) => item.movement_type === "Stock Out"
                    ).length}
              </h2>
              <small>Recorded stock decreases</small>
            </div>
          </div>

          <div className="product-filters">
            <div className="search-box">
              <span aria-hidden="true">🔍</span>
              <input
                type="search"
                value={movementSearch}
                onChange={(event) => setMovementSearch(event.target.value)}
                placeholder="Search product name..."
                aria-label="Search stock movement by product name"
              />
            </div>

            <div className="category-filter">
              <label htmlFor="movement-filter">Movement Type:</label>
              <select
                id="movement-filter"
                value={movementFilter}
                onChange={(event) => setMovementFilter(event.target.value)}
              >
                <option value="All">All Movements</option>
                <option value="Stock In">Stock In</option>
                <option value="Stock Out">Stock Out</option>
              </select>
            </div>

            <div className="category-filter">
              <label htmlFor="movement-start-date">From:</label>
              <input
                id="movement-start-date"
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div className="category-filter">
              <label htmlFor="movement-end-date">To:</label>
              <input
                id="movement-end-date"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>

            {(movementSearch ||
              movementFilter !== "All" ||
              startDate ||
              endDate) && (
              <button
                type="button"
                className="clear-filters-button"
                onClick={clearMovementFilters}
              >
                Clear Filters
              </button>
            )}
          </div>

          {movementError ? (
            <div className="notice error-notice" role="alert">
              {movementError}
            </div>
          ) : movementLoading ? (
            <div className="empty-state">
              Loading stock movement history...
            </div>
          ) : stockMovements.length === 0 ? (
            <div className="empty-state">
              <h3>No Stock Movements Yet</h3>
              <p>
                Stock changes will appear here when products are added or
                their quantities are updated.
              </p>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="empty-state">
              <h3>No Matching Movements</h3>
              <p>Try changing your search, movement type or date range.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>DATE &amp; TIME</th>
                    <th>PRODUCT</th>
                    <th>MOVEMENT</th>
                    <th>QUANTITY CHANGED</th>
                    <th>PREVIOUS STOCK</th>
                    <th>NEW STOCK</th>
                    <th>NOTES</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{formatDateTime(movement.created_at)}</td>
                      <td>{movement.product_name}</td>

                      <td>
                        <span
                          className={`badge ${
                            movement.movement_type === "Stock In"
                              ? "in-stock"
                              : "out-stock"
                          }`}
                        >
                          {movement.movement_type}
                        </span>
                      </td>

                      <td>
                        {movement.movement_type === "Stock In" ? "+" : "-"}
                        {movement.quantity}
                      </td>

                      <td>{movement.previous_quantity}</td>
                      <td>{movement.new_quantity}</td>
                      <td>{movement.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!movementLoading &&
            !movementError &&
            stockMovements.length > 0 && (
              <p className="results-count">
                Showing {filteredMovements.length} of {stockMovements.length}
                {" "}recent movements. The API returns up to 200 records.
              </p>
            )}
        </section>

    
{isAdmin && (
  <>
    <div id="category-management">
  <CategoryManagement />
</div>

<div id="staff-management">
  <StaffManagement />
</div>

<div id="activity-logs">
  <ActivityLog />
</div>
  </>
)}


        <section className="products-section" id="reports">
          <div className="section-heading">
            <div>
              <h2>Inventory Summary</h2>
              <p>A quick summary of your current inventory.</p>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon purple">🗂</div>
              <p>Total Categories</p>
              <h2>{loading ? "..." : categories.length - 1}</h2>
              <small>Categories used by existing products</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon green">₹</div>
              <p>Inventory Value</p>
              <h2>{loading ? "..." : currency(inventoryValue)}</h2>
              <small>Total price multiplied by quantity</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">⚠</div>
              <p>Products Requiring Attention</p>
              <h2>{loading ? "..." : stockAlerts.length}</h2>
              <small>Low-stock and out-of-stock products</small>
            </div>
          </div>

          <div className="section-heading">
            <div>
              <h2>Low Stock Report</h2>
              <p>
                Review products that need restocking and export the report
                for your records.
              </p>
            </div>

            <button
              type="button"
              onClick={exportLowStockReport}
              disabled={
                loading ||
                exportingLowStock ||
                stockAlerts.length === 0
              }
            >
              {exportingLowStock
                ? "Exporting..."
                : "↓ Export Low Stock Report"}
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon orange">⚠</div>
              <p>Low Stock Products</p>
              <h2>{loading ? "..." : lowStock}</h2>
              <small>
                Products with quantity above zero but at or below minimum
              </small>
            </div>

            <div className="stat-card">
              <div className="stat-icon purple">📦</div>
              <p>Out of Stock Products</p>
              <h2>{loading ? "..." : outOfStock}</h2>
              <small>Products with zero quantity</small>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">Loading low stock report...</div>
          ) : stockAlerts.length === 0 ? (
            <div className="empty-state">
              <h3>No Products Require Restocking</h3>
              <p>All products are above their minimum stock levels.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>PRODUCT</th>
                    <th>SKU</th>
                    <th>CATEGORY</th>
                    <th>PRICE</th>
                    <th>CURRENT STOCK</th>
                    <th>MINIMUM STOCK</th>
                    <th>RESTOCK NEEDED</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>
                  {stockAlerts.map((product) => {
                    const status = getStatus(product);
                    const quantity = Number(product.quantity) || 0;
                    const minimum = Number(product.min_stock) || 0;
                    const restockNeeded = Math.max(minimum - quantity, 0);

                    return (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>{product.sku}</td>
                        <td>{product.category}</td>
                        <td>{currency(Number(product.price) || 0)}</td>
                        <td>{quantity}</td>
                        <td>{minimum}</td>
                        <td>{restockNeeded}</td>
                        <td>
                          <span className={`badge ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && (
            <p className="results-count">
              {stockAlerts.length} product(s) included in the low stock report.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
