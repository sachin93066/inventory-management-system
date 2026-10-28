
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api";

const STAFF_API = "http://127.0.0.1:5000/api/auth/staff";

function StaffManagement() {
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
  });

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch(STAFF_API);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load staff accounts.");
      }

      setStaffList(data);
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response = await apiFetch(STAFF_API, {
        method: "POST",
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create staff account.");
      }

      setMessage(data.message || "Staff account created successfully.");

      setFormData({
        name: "",
        username: "",
        email: "",
        password: "",
      });

      await loadStaff();
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(staff) {
    const nextStatus = !staff.is_active;
    const action = nextStatus ? "activate" : "deactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${staff.name}'s account?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");
    setUpdatingId(staff.id);

    try {
      const response = await apiFetch(
        `${STAFF_API}/${staff.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ is_active: nextStatus }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to update staff account status."
        );
      }

      setMessage(data.message || "Staff status updated successfully.");
      await loadStaff();
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="staff-management">
      <div className="staff-heading">
        <div>
          <h2>Staff Management</h2>
          <p>Create staff accounts and manage account access.</p>
        </div>

        <button
          type="button"
          className="staff-refresh-btn"
          onClick={loadStaff}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh List"}
        </button>
      </div>

      {error && <div className="staff-alert staff-error">{error}</div>}
      {message && (
        <div className="staff-alert staff-success">{message}</div>
      )}

      <div className="staff-create-card">
        <h3>Create Staff Account</h3>

        <form onSubmit={handleSubmit} className="staff-form">
          <div className="staff-form-grid">
            <label>
              Full Name
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter full name"
                required
              />
            </label>

            <label>
              Username
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Choose username"
                required
              />
            </label>

            <label>
              Email Address
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email address"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create password"
                minLength={6}
                required
              />
            </label>
          </div>

          <button
            type="submit"
            className="staff-primary-btn"
            disabled={saving}
          >
            {saving ? "Creating Account..." : "Create Staff Account"}
          </button>
        </form>
      </div>

      <div className="staff-list-card">
        <div className="staff-list-heading">
          <h3>Staff Accounts</h3>
          <span>{staffList.length} total</span>
        </div>

        {loading ? (
          <p className="staff-empty">Loading staff accounts...</p>
        ) : staffList.length === 0 ? (
          <p className="staff-empty">
            No staff accounts found. Create your first staff account above.
          </p>
        ) : (
          <div className="staff-table-wrapper">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {staffList.map((staff) => (
                  <tr key={staff.id}>
                    <td>{staff.name}</td>
                    <td>{staff.username}</td>
                    <td>{staff.email}</td>
                    <td>
                      <span
                        className={`staff-status ${
                          staff.is_active ? "active" : "inactive"
                        }`}
                      >
                        {staff.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`staff-status-btn ${
                          staff.is_active
                            ? "deactivate-btn"
                            : "activate-btn"
                        }`}
                        onClick={() => handleStatusChange(staff)}
                        disabled={updatingId === staff.id}
                      >
                        {updatingId === staff.id
                          ? "Updating..."
                          : staff.is_active
                          ? "Deactivate"
                          : "Activate"}
                      </button>
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

export default StaffManagement;
