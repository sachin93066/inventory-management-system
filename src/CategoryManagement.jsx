
import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import "./CategoryManagement.css";

const CATEGORY_API = "http://127.0.0.1:5000/api/categories";

function CategoryManagement() {
  const [categories, setCategories] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadCategories() {
    try {
      setError("");

      const response = await apiFetch(CATEGORY_API);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.msg || "Unable to load categories."
        );
      }

      setCategories(Array.isArray(data) ? data : data.categories || []);
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function handleAddCategory(event) {
    event.preventDefault();

    const name = categoryName.trim();
    if (!name) {
      setError("Please enter a category name.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(CATEGORY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.msg || "Unable to add category.");
      }

      setCategoryName("");
      setMessage("Category added successfully!");
      await loadCategories();
    } catch (err) {
      setError(err.message || "Unable to add category.");
    } finally {
      setSaving(false);
    }
  }

  function startRename(category) {
    setEditingId(category.id);
    setEditingName(category.name);
    setError("");
    setMessage("");
  }

  async function handleRename(event) {
    event.preventDefault();

    const name = editingName.trim();
    if (!name) {
      setError("Please enter a category name.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(`${CATEGORY_API}/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.msg || "Unable to rename category.");
      }

      setEditingId(null);
      setEditingName("");
      setMessage("Category renamed successfully!");
      await loadCategories();
    } catch (err) {
      setError(err.message || "Unable to rename category.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${category.name}"?`
    );

    if (!confirmed) return;

    setDeletingId(category.id);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(`${CATEGORY_API}/${category.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.msg || "Unable to delete category.");
      }

      setMessage("Category deleted successfully!");
      await loadCategories();
    } catch (err) {
      setError(err.message || "Unable to delete category.");
    } finally {
      setDeletingId(null);
    }
  }

  const totalProducts = categories.reduce(
    (total, category) => total + Number(category.product_count || 0),
    0
  );

  return (
    <section className="category-management" id="category-management">
      <div className="category-page-heading">
        <div>
          <span className="category-eyebrow">INVENTORY ORGANIZATION</span>
          <h2>Category Management</h2>
          <p>Organize your products into clear categories.</p>
        </div>

        <div className="category-total-badge">
          <span className="category-total-icon">▦</span>
          <div>
            <strong>{categories.length}</strong>
            <span>Total Categories</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="category-alert category-alert-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="category-alert category-alert-success" role="status">
          {message}
        </div>
      )}

      <div className="category-summary-grid">
        <div className="category-summary-card">
          <span className="summary-icon purple-icon">▤</span>
          <div>
            <p>Total Categories</p>
            <h3>{loading ? "..." : categories.length}</h3>
          </div>
        </div>

        <div className="category-summary-card">
          <span className="summary-icon blue-icon">📦</span>
          <div>
            <p>Products Categorized</p>
            <h3>{loading ? "..." : totalProducts}</h3>
          </div>
        </div>
      </div>

      <div className="category-add-card">
        <div className="category-card-heading">
          <div className="category-heading-icon">+</div>
          <div>
            <h3>Add New Category</h3>
            <p>Create a category for organizing your inventory.</p>
          </div>
        </div>

        <form className="category-add-form" onSubmit={handleAddCategory}>
          <label htmlFor="new-category-name">Category Name</label>
          <div className="category-input-row">
            <input
              id="new-category-name"
              type="text"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="e.g. Electronics"
              maxLength={100}
              required
              disabled={saving}
            />
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "+ Add Category"}
            </button>
          </div>
        </form>
      </div>

      <div className="category-list-card">
        <div className="category-list-heading">
          <div>
            <h3>All Categories</h3>
            <p>Manage your existing product categories.</p>
          </div>
          <button
            type="button"
            className="category-refresh-button"
            onClick={loadCategories}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="category-empty-state">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="category-empty-state">
            <span>▤</span>
            <h4>No categories yet</h4>
            <p>Add your first category using the form above.</p>
          </div>
        ) : (
          <div className="category-table-wrapper">
            <table className="category-table">
              <thead>
                <tr>
                  <th>CATEGORY</th>
                  <th>PRODUCT COUNT</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      {editingId === category.id ? (
                        <form className="category-rename-form" onSubmit={handleRename}>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            maxLength={100}
                            required
                            autoFocus
                          />
                          <button type="submit" disabled={saving}>
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            className="category-cancel-button"
                            onClick={() => {
                              setEditingId(null);
                              setEditingName("");
                            }}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <div className="category-name-cell">
                          <span className="category-folder-icon">▰</span>
                          <strong>{category.name}</strong>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="product-count-pill">
                        {category.product_count ?? 0}{" "}
                        {Number(category.product_count) === 1 ? "Product" : "Products"}
                      </span>
                    </td>
                    <td>
                      {editingId !== category.id && (
                        <div className="category-action-buttons">
                          <button
                            type="button"
                            className="category-edit-button"
                            onClick={() => startRename(category)}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="category-delete-button"
                            onClick={() => handleDelete(category)}
                            disabled={deletingId === category.id}
                          >
                            {deletingId === category.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default CategoryManagement;
