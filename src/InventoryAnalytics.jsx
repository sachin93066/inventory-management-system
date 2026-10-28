
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import "./InventoryAnalytics.css";

function InventoryAnalytics({ products = [], loading = false, currency }) {
  // Group products by category
  const categoryMap = {};

  products.forEach((product) => {
    const category = product.category || "Uncategorized";

    if (!categoryMap[category]) {
      categoryMap[category] = {
        category,
        units: 0,
        value: 0,
      };
    }

    categoryMap[category].units += Number(product.quantity) || 0;

    categoryMap[category].value +=
      (Number(product.price) || 0) *
      (Number(product.quantity) || 0);
  });

  const categoryData = Object.values(categoryMap).sort(
    (a, b) => b.units - a.units
  );

  // Count products by stock status
  let inStockCount = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  products.forEach((product) => {
    const quantity = Number(product.quantity) || 0;
    const minimum = Number(product.min_stock) || 0;

    if (quantity <= 0) {
      outOfStockCount++;
    } else if (quantity <= minimum) {
      lowStockCount++;
    } else {
      inStockCount++;
    }
  });

  const statusData = [
    { name: "In Stock", value: inStockCount, color: "#16a34a" },
    { name: "Low Stock", value: lowStockCount, color: "#f59e0b" },
    { name: "Out of Stock", value: outOfStockCount, color: "#ef4444" },
  ];

  const formatCurrency = (value) =>
    typeof currency === "function"
      ? currency(value)
      : `₹${Number(value).toLocaleString("en-IN")}`;

  if (loading) {
    return (
      <section className="analytics-section" id="analytics">
        <div className="analytics-heading">
          <div>
            <h2>Inventory Analytics</h2>
            <p>Visual insights into your inventory.</p>
          </div>
        </div>

        <div className="analytics-empty">
          Loading inventory analytics...
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="analytics-section" id="analytics">
        <div className="analytics-heading">
          <div>
            <h2>Inventory Analytics</h2>
            <p>Visual insights into your inventory.</p>
          </div>
        </div>

        <div className="analytics-empty">
          <h3>No Data Available</h3>
          <p>Add products to view inventory charts.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="analytics-section" id="analytics">
      <div className="analytics-heading">
        <div>
          <h2>Inventory Analytics</h2>
          <p>
            Understand your stock levels, product categories and inventory
            value at a glance.
          </p>
        </div>

        <span className="analytics-live-label">
          Live Inventory Data
        </span>
      </div>

      <div className="analytics-grid">
        {/* Chart 1: Category-wise stock */}
        <article className="analytics-card">
          <div className="analytics-card-heading">
            <div>
              <h3>Category-wise Stock</h3>
              <p>Total units available in each category</p>
            </div>
            <span className="analytics-icon purple">▥</span>
          </div>

          {categoryData.length === 0 ? (
            <div className="analytics-empty">No category data available.</div>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryData}
                  margin={{ top: 10, right: 12, left: 0, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e5e7eb"
                  />

                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={55}
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                  />

                  <Tooltip
                    formatter={(value) => [
                      Number(value).toLocaleString("en-IN"),
                      "Stock Units",
                    ]}
                  />

                  <Legend />

                  <Bar
                    dataKey="units"
                    name="Stock Units"
                    fill="#7066e0"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="analytics-card-footer">
            <span>Total categories</span>
            <strong>{categoryData.length}</strong>
          </div>
        </article>

        {/* Chart 2: Stock status distribution */}
        <article className="analytics-card">
          <div className="analytics-card-heading">
            <div>
              <h3>Stock Status Distribution</h3>
              <p>Products grouped by current stock status</p>
            </div>
            <span className="analytics-icon orange">◉</span>
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="46%"
                  innerRadius={62}
                  outerRadius={95}
                  paddingAngle={4}
                  stroke="none"
                >
                  {statusData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color}
                    />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(value, name) => [
                    `${value} product(s)`,
                    name,
                  ]}
                />

                <Legend verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="status-summary">
            {statusData.map((item) => (
              <div className="status-summary-item" key={item.name}>
                <span
                  className="status-dot"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.name}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        {/* Chart 3: Inventory value by category */}
        <article className="analytics-card analytics-card-wide">
          <div className="analytics-card-heading">
            <div>
              <h3>Inventory Value by Category</h3>
              <p>
                Total value of available stock, calculated using price ×
                quantity
              </p>
            </div>
            <span className="analytics-icon green">₹</span>
          </div>

          {categoryData.length === 0 ? (
            <div className="analytics-empty">No category data available.</div>
          ) : (
            <div className="chart-container chart-container-wide">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryData}
                  margin={{ top: 12, right: 20, left: 12, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e5e7eb"
                  />

                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />

                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) =>
                      value >= 100000
                        ? `₹${(value / 100000).toFixed(1)}L`
                        : value >= 1000
                          ? `₹${(value / 1000).toFixed(1)}K`
                          : `₹${value}`
                    }
                    width={75}
                  />

                  <Tooltip
                    formatter={(value) => [
                      formatCurrency(value),
                      "Inventory Value",
                    ]}
                  />

                  <Legend />

                  <Bar
                    dataKey="value"
                    name="Inventory Value"
                    fill="#16a085"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={58}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="analytics-card-footer">
            <span>Total inventory value</span>
            <strong>
              {formatCurrency(
                categoryData.reduce((sum, item) => sum + item.value, 0)
              )}
            </strong>
          </div>
        </article>
      </div>
    </section>
  );
}

export default InventoryAnalytics;
