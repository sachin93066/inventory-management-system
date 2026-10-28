
import { useMemo, useState } from "react";
import "./App.css";

function StockMovementAnalytics({
  stockMovements = [],
  loading = false,
  error = "",
}) {
  const [dateRange, setDateRange] = useState("7");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  const filteredMovements = useMemo(() => {
    let startDate = "";
    let endDate = todayString;

    if (dateRange === "today") {
      startDate = todayString;
    } else if (dateRange === "7" || dateRange === "30") {
      const start = new Date(today);
      start.setDate(start.getDate() - (Number(dateRange) - 1));

      startDate = [
        start.getFullYear(),
        String(start.getMonth() + 1).padStart(2, "0"),
        String(start.getDate()).padStart(2, "0"),
      ].join("-");
    } else if (dateRange === "custom") {
      startDate = customStartDate;
      endDate = customEndDate;
    } else if (dateRange === "all") {
      endDate = "";
    }

    return stockMovements.filter((movement) => {
      const movementDate = String(movement.created_at || "").slice(0, 10);

      if (!movementDate) return false;
      if (startDate && movementDate < startDate) return false;
      if (endDate && movementDate > endDate) return false;

      return true;
    });
  }, [
    stockMovements,
    dateRange,
    customStartDate,
    customEndDate,
    todayString,
  ]);

  const summary = useMemo(() => {
    let stockInCount = 0;
    let stockOutCount = 0;
    let quantityAdded = 0;
    let quantityReduced = 0;

    filteredMovements.forEach((movement) => {
      const quantity = Number(movement.quantity) || 0;
      const type = String(movement.movement_type || "").toLowerCase();

      if (["in", "stock in", "stock_in"].includes(type)) {
        stockInCount += 1;
        quantityAdded += quantity;
      } else if (["out", "stock out", "stock_out"].includes(type)) {
        stockOutCount += 1;
        quantityReduced += quantity;
      }
    });

    return {
      total: filteredMovements.length,
      stockInCount,
      stockOutCount,
      quantityAdded,
      quantityReduced,
    };
  }, [filteredMovements]);

  // Prepare daily data for the Stock In vs Stock Out chart.
  const dailyChartData = useMemo(() => {
    const dailyData = {};

    filteredMovements.forEach((movement) => {
      const date = String(movement.created_at || "").slice(0, 10);
      if (!date) return;

      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          stockIn: 0,
          stockOut: 0,
        };
      }

      const quantity = Number(movement.quantity) || 0;
      const type = String(movement.movement_type || "").toLowerCase();

      if (["in", "stock in", "stock_in"].includes(type)) {
        dailyData[date].stockIn += quantity;
      } else if (["out", "stock out", "stock_out"].includes(type)) {
        dailyData[date].stockOut += quantity;
      }
    });

    return Object.values(dailyData).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [filteredMovements]);

  const maxDailyQuantity = Math.max(
    1,
    ...dailyChartData.flatMap((day) => [day.stockIn, day.stockOut])
  );

  const cardStyle = {
    background: "var(--card-bg, #ffffff)",
    border: "1px solid var(--border-color, #e5e7eb)",
    borderRadius: "12px",
    padding: "20px",
    minWidth: 0,
  };

  const labelStyle = {
    margin: 0,
    color: "var(--muted-text, #6b7280)",
    fontSize: "14px",
  };

  const valueStyle = {
    margin: "10px 0 0",
    fontSize: "28px",
    fontWeight: 700,
    color: "var(--text-color, #111827)",
  };

  const invalidCustomRange =
    dateRange === "custom" &&
    customStartDate &&
    customEndDate &&
    customStartDate > customEndDate;

  // Export the filtered stock movements to CSV.
  function handleExportCSV() {
    if (invalidCustomRange || filteredMovements.length === 0) return;

    const headers = [
      "Date",
      "Product Name",
      "Movement Type",
      "Quantity",
      "Previous Quantity",
      "New Quantity",
      "Notes",
    ];

    // Escape commas, quotes, and newlines for valid CSV.
    const escapeCSV = (value) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const rows = filteredMovements.map((movement) => [
      String(movement.created_at || "").slice(0, 10),
      movement.product_name || "",
      movement.movement_type || "",
      movement.quantity ?? 0,
      movement.previous_quantity ?? "",
      movement.new_quantity ?? "",
      movement.notes || "",
    ]);

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\r\n");

    // BOM helps Excel display UTF-8 text correctly.
    const blob = new Blob(["\uFEFF", csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `stock_movement_report_${dateRange}_${todayString}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <section style={{ marginTop: "28px" }}>
      {/* Header and date range filter */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <div>
          <h2 style={{ marginBottom: "6px" }}>
            Stock Movement Analytics
          </h2>
          <p style={{ margin: 0, color: "#6b7280" }}>
            Analyze stock activity for your selected date range.
          </p>
        </div>

        <select
          value={dateRange}
          onChange={(event) => setDateRange(event.target.value)}
          aria-label="Select analytics date range"
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            background: "#ffffff",
            color: "#111827",
            minWidth: "170px",
          }}
        >
          <option value="today">Today</option>
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="all">All Time</option>
          <option value="custom">Custom Range</option>
        </select>
      </div>

      {/* Custom date range */}
      {dateRange === "custom" && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <label>
            <span style={{ display: "block", marginBottom: "6px" }}>
              Start Date
            </span>
            <input
              type="date"
              value={customStartDate}
              max={customEndDate || todayString}
              onChange={(event) => setCustomStartDate(event.target.value)}
              style={{ padding: "9px", borderRadius: "7px" }}
            />
          </label>

          <label>
            <span style={{ display: "block", marginBottom: "6px" }}>
              End Date
            </span>
            <input
              type="date"
              value={customEndDate}
              min={customStartDate || undefined}
              max={todayString}
              onChange={(event) => setCustomEndDate(event.target.value)}
              style={{ padding: "9px", borderRadius: "7px" }}
            />
          </label>
        </div>
      )}

      {error && (
        <p role="alert" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading stock movement analytics...</p>
      ) : invalidCustomRange ? (
        <p style={{ color: "#dc2626" }}>
          Please select a valid date range.
        </p>
      ) : (
        <>
          {/* Export CSV button */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "16px",
            }}
          >
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredMovements.length === 0}
              style={{
                padding: "10px 16px",
                border: "none",
                borderRadius: "8px",
                background:
                  filteredMovements.length === 0 ? "#9ca3af" : "#2563eb",
                color: "#ffffff",
                fontWeight: 600,
                cursor:
                  filteredMovements.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Export CSV
            </button>
          </div>

          {/* Summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
            }}
          >
            <div style={cardStyle}>
              <p style={labelStyle}>Total Movements</p>
              <p style={valueStyle}>{summary.total}</p>
            </div>

            <div style={cardStyle}>
              <p style={labelStyle}>Stock In Operations</p>
              <p style={{ ...valueStyle, color: "#16a34a" }}>
                {summary.stockInCount}
              </p>
              <p style={labelStyle}>
                Units added: {summary.quantityAdded}
              </p>
            </div>

            <div style={cardStyle}>
              <p style={labelStyle}>Stock Out Operations</p>
              <p style={{ ...valueStyle, color: "#dc2626" }}>
                {summary.stockOutCount}
              </p>
              <p style={labelStyle}>
                Units reduced: {summary.quantityReduced}
              </p>
            </div>

            <div style={cardStyle}>
              <p style={labelStyle}>Net Quantity Change</p>
              <p
                style={{
                  ...valueStyle,
                  color:
                    summary.quantityAdded - summary.quantityReduced >= 0
                      ? "#16a34a"
                      : "#dc2626",
                }}
              >
                {summary.quantityAdded - summary.quantityReduced > 0
                  ? "+"
                  : ""}
                {summary.quantityAdded - summary.quantityReduced}
              </p>
            </div>
          </div>

          {/* Daily Stock In vs Stock Out chart */}
          <div
            style={{
              ...cardStyle,
              marginTop: "18px",
              overflowX: "auto",
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              Daily Stock In vs Stock Out
            </h3>

            <div
              style={{
                display: "flex",
                gap: "18px",
                marginBottom: "20px",
                flexWrap: "wrap",
              }}
            >
              <span>
                <span style={{ color: "#16a34a" }}>●</span> Stock In
              </span>
              <span>
                <span style={{ color: "#dc2626" }}>●</span> Stock Out
              </span>
            </div>

            {dailyChartData.length === 0 ? (
              <p>No stock movement data available for this date range.</p>
            ) : (
              <div style={{ display: "grid", gap: "18px" }}>
                {dailyChartData.slice(-14).map((day) => (
                  <div key={day.date}>
                    <p style={{ margin: "0 0 8px", fontSize: "13px" }}>
                      {day.date}
                    </p>

                    {/* Stock In bar */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "70px minmax(0, 1fr) 35px",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "6px",
                      }}
                    >
                      <span style={{ fontSize: "12px" }}>Stock In</span>
                      <div
                        style={{
                          height: "14px",
                          background: "#f3f4f6",
                          borderRadius: "5px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${(day.stockIn / maxDailyQuantity) * 100}%`,
                            height: "100%",
                            background: "#16a34a",
                            borderRadius: "5px",
                          }}
                        />
                      </div>
                      <strong style={{ fontSize: "12px" }}>
                        {day.stockIn}
                      </strong>
                    </div>

                    {/* Stock Out bar */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "70px minmax(0, 1fr) 35px",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span style={{ fontSize: "12px" }}>Stock Out</span>
                      <div
                        style={{
                          height: "14px",
                          background: "#f3f4f6",
                          borderRadius: "5px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${(day.stockOut / maxDailyQuantity) * 100}%`,
                            height: "100%",
                            background: "#dc2626",
                            borderRadius: "5px",
                          }}
                        />
                      </div>
                      <strong style={{ fontSize: "12px" }}>
                        {day.stockOut}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {dailyChartData.length > 14 && (
              <p style={{ color: "#6b7280", fontSize: "13px" }}>
                Showing the latest 14 days with recorded stock movements.
              </p>
            )}
          </div>

          {/* Recent Stock Activity table */}
          <div
            style={{
              ...cardStyle,
              marginTop: "18px",
              overflowX: "auto",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Recent Stock Activity</h3>

            {filteredMovements.length === 0 ? (
              <p>No stock movements found for this date range.</p>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "550px",
                }}
              >
                <thead>
                  <tr>
                    {["Date", "Product", "Movement", "Quantity"].map(
                      (heading) => (
                        <th
                          key={heading}
                          style={{
                            textAlign: "left",
                            padding: "12px 10px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {[...filteredMovements]
                    .sort(
                      (a, b) =>
                        new Date(b.created_at) - new Date(a.created_at)
                    )
                    .slice(0, 10)
                    .map((movement, index) => (
                      <tr
                        key={
                          movement.id ??
                          `${movement.created_at}-${index}`
                        }
                      >
                        <td
                          style={{
                            padding: "12px 10px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          {String(movement.created_at || "").slice(0, 10)}
                        </td>
                        <td
                          style={{
                            padding: "12px 10px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          {movement.product_name || "Unknown Product"}
                        </td>
                        <td
                          style={{
                            padding: "12px 10px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          {movement.movement_type || "Unknown"}
                        </td>
                        <td
                          style={{
                            padding: "12px 10px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          {movement.quantity ?? 0}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}

            {filteredMovements.length > 10 && (
              <p style={{ color: "#6b7280", marginBottom: 0 }}>
                Showing the 10 most recent movements out of{" "}
                {filteredMovements.length}.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default StockMovementAnalytics;
