
import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import "./ActivityLog.css";

const API_URL = "http://127.0.0.1:5000/api/activity-logs";

function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchLogs() {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(API_URL);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load activity logs.");
      }

      setLogs(Array.isArray(data) ? data : data.logs || []);
    } catch (err) {
      setError(err.message || "Unable to load activity logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString("en-IN");
  }

  return (
    <section className="activity-log-section" id="activity-logs">
      <div className="activity-log-header">
        <div>
          <h2>Activity Logs</h2>
          <p>Track user actions across your inventory system.</p>
        </div>

        <button
          type="button"
          className="activity-refresh-btn"
          onClick={fetchLogs}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <div className="activity-error">{error}</div>}

      {loading ? (
        <div className="activity-empty">Loading activity logs...</div>
      ) : logs.length === 0 ? (
        <div className="activity-empty">
          No activity logs found yet.
        </div>
      ) : (
        <div className="activity-table-wrapper">
          <table className="activity-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Description</th>
                <th>Date &amp; Time</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log, index) => (
                <tr key={log.id ?? index}>
                  <td>{log.user_name || "System"}</td>
                  <td>
                    <span className="activity-role">
                      {log.user_role || "—"}
                    </span>
                  </td>
                  <td>
                    <span className="activity-action">
                      {log.action || "—"}
                    </span>
                  </td>
                  <td>{log.description || "—"}</td>
                  <td>{formatDate(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default ActivityLog;
