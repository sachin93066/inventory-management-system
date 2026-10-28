# StockFlow Inventory Management System

StockFlow is an inventory management application built to manage products, categories, stock quantities, and inventory activities through a web-based dashboard.

## Features

- **Dashboard:** View inventory summary and key stock statistics.
- **Product Management:** Add, view, update, search, and delete products.
- **Category Management:** Manage product categories.
- **Stock Alerts:** Identify products with low stock.
- **Quick Restock:** Update product quantities when new stock arrives.
- **Stock Movement:** Track changes in inventory quantities.
- **Inventory Analytics:** View inventory-related summaries and analytics.
- **Staff Management:** Allow administrators to manage staff accounts.
- **Activity Logs:** Review recorded user activities.
- **Role-Based Access:** Separate administrator and staff permissions.
- **Authentication:** Login with token-based authentication.

## Technologies Used

### Frontend
- React
- Vite
- JavaScript
- HTML
- CSS

### Backend
- Python
- Flask
- Flask-CORS
- Flask-JWT-Extended

### Database
- MySQL

## Project Structure

```text
inventory-management-system/
├── backend/
│   ├── app.py
│   ├── db.py
│   └── .env
├── src/
│   ├── App.jsx
│   ├── Dashboard.jsx
│   ├── CategoryManagement.jsx
│   ├── StaffManagement.jsx
│   ├── ActivityLog.jsx
│   ├── InventoryAnalytics.jsx
│   ├── StockMovementAnalytics.jsx
│   ├── api.js
│   └── App.css
├── index.html
├── package.json
└── README.md
```

*Note: The structure above is a simplified overview. Your actual project may contain additional files and folders.*

## Prerequisites

Install the following software before running the project:

- Node.js and npm
- Python
- MySQL Server
- MySQL Workbench (optional, for database management)

## Database Setup

1. Start MySQL Server.
2. Open MySQL Workbench.
3. Create the database named `inventory_db` if it does not already exist.
4. Configure the database connection in the backend configuration.
5. Ensure the required tables are created by following the backend setup.

## Backend Setup

Open a terminal in the backend directory:

```powershell
cd backend
```

Activate the virtual environment if it already exists:

```powershell
.\venv\Scripts\Activate.ps1
```

Install the required Python packages if necessary:

```powershell
pip install Flask Flask-Cors Flask-JWT-Extended mysql-connector-python python-dotenv
```

Configure the environment variables in the backend `.env` file, including the database connection details and JWT secret.

Start the Flask server:

```powershell
python app.py
```

The backend API is configured to run on port `5000`.

## Frontend Setup

Open a separate terminal in the project root directory:

```powershell
npm install
npm run dev
```

Open the local URL displayed by Vite in your browser.

## User Roles

### Administrator
- Manage products and categories.
- Manage staff accounts.
- Access activity logs.
- Perform administrative inventory operations.

### Staff
- Access permitted inventory features.
- View and update stock information according to assigned permissions.
- Access features allowed by the backend authorization rules.

## Security Notes

- Keep the backend `.env` file private.
- Never publish database passwords or JWT secrets.
- Do not commit secret configuration files to a public repository.
- Use backend authorization checks to enforce user permissions.

## Database Backup

Keep a backup of the `inventory_db` database before making major changes. A MySQL SQL export can be used for recovery.

## Future Improvements

- Automated inventory reports.
- Additional analytics and visualizations.
- Improved deployment and monitoring.

## Author

StockFlow Inventory Management System
