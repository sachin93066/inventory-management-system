
import os
import math
import mysql.connector

from pathlib import Path
from decimal import Decimal
from datetime import date, datetime
from functools import wraps

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
)

from db import get_db_connection


# ==================================================
# ENVIRONMENT SETTINGS
# ==================================================

def load_env_file():
    """Load environment settings from the .env file beside app.py."""
    env_path = Path(__file__).resolve().parent / ".env"

    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if key:
            os.environ.setdefault(key, value)


load_env_file()

JWT_SECRET = os.getenv("JWT_SECRET_KEY")

if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET_KEY is missing. Add it to the backend .env file."
    )


# ==================================================
# FLASK APP
# ==================================================

app = Flask(__name__)

app.config["JWT_SECRET_KEY"] = JWT_SECRET
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 60 * 60 * 8

CORS(app)
jwt = JWTManager(app)


# ==================================================
# HELPER FUNCTIONS
# ==================================================

def serialize_value(value):
    if isinstance(value, Decimal):
        return float(value)

    if isinstance(value, (date, datetime)):
        return value.isoformat()

    return value


def serialize_row(row):
    return {
        key: serialize_value(value)
        for key, value in row.items()
    }


def get_request_data():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else None


def valid_nonnegative_number(value):
    try:
        number = float(value)
        return math.isfinite(number) and number >= 0
    except (TypeError, ValueError, OverflowError):
        return False


def close_db(cursor=None, connection=None):
    if cursor:
        cursor.close()

    if connection and connection.is_connected():
        connection.close()


def get_logged_in_user():
    """Return the active user associated with the current JWT."""
    connection = None
    cursor = None

    try:
        user_id = int(get_jwt_identity())

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, name, username, email, role, is_active
            FROM users
            WHERE id = %s
            LIMIT 1
        """, (user_id,))

        user = cursor.fetchone()

        if not user or not user["is_active"]:
            return None

        return user

    finally:
        close_db(cursor, connection)


def record_activity(cursor, user, action, description):
    """Insert an activity record using the current database transaction."""
    if not user:
        return

    cursor.execute("""
        INSERT INTO activity_logs (
            user_id,
            user_name,
            user_role,
            action,
            description
        )
        VALUES (%s, %s, %s, %s, %s)
    """, (
        user["id"],
        user["name"],
        user["role"],
        action,
        description
    ))


def admin_required(view_function):
    """Allow only active admin accounts to access protected routes."""

    @wraps(view_function)
    def wrapped(*args, **kwargs):
        try:
            user = get_logged_in_user()

            if not user:
                return jsonify({
                    "error": "Your account is unavailable. Please log in again."
                }), 401

            if user["role"] != "admin":
                return jsonify({
                    "error": "Admin permission is required for this action."
                }), 403

            return view_function(*args, **kwargs)

        except Exception:
            app.logger.exception("Unable to verify admin permission")
            return jsonify({
                "error": "Unable to verify permissions."
            }), 500

    return wrapped


def record_stock_movement(
    cursor,
    product_id,
    product_name,
    movement_type,
    quantity,
    previous_quantity,
    new_quantity,
    notes=None
):
    if quantity <= 0:
        return

    cursor.execute("""
        INSERT INTO stock_movements (
            product_id,
            product_name,
            movement_type,
            quantity,
            previous_quantity,
            new_quantity,
            notes
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
        product_id,
        product_name,
        movement_type,
        quantity,
        previous_quantity,
        new_quantity,
        notes
    ))


# ==================================================
# DATABASE SETUP FOR ACTIVITY LOGS
# ==================================================

def ensure_activity_logs_table():
    """Create the activity log table if it does not exist."""
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                user_name VARCHAR(100) NOT NULL,
                user_role VARCHAR(20) NOT NULL,
                action VARCHAR(100) NOT NULL,
                description VARCHAR(500) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_activity_created_at (created_at),
                INDEX idx_activity_user_id (user_id),
                CONSTRAINT fk_activity_user
                    FOREIGN KEY (user_id)
                    REFERENCES users(id)
                    ON DELETE SET NULL
            )
        """)

        connection.commit()
        app.logger.info("Activity logs table is ready.")

    finally:
        close_db(cursor, connection)


# ==================================================
# AUTHENTICATION APIs
# ==================================================

# INITIAL ADMIN REGISTRATION
# Only the first account can register through this endpoint.

@app.route("/api/auth/register", methods=["POST"])
def register_first_user():
    connection = None
    cursor = None
    lock_acquired = False

    data = get_request_data()

    if data is None:
        return jsonify({"error": "Invalid request data."}), 400

    name = str(data.get("name") or "").strip()
    username = str(data.get("username") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    password = data.get("password")

    if (
        not name
        or not username
        or not email
        or not isinstance(password, str)
    ):
        return jsonify({
            "error": "Name, username, email, and password are required."
        }), 400

    if len(name) > 100 or len(username) > 50 or len(email) > 150:
        return jsonify({
            "error": "One or more fields are too long."
        }), 400

    if len(username) < 3:
        return jsonify({
            "error": "Username must contain at least 3 characters."
        }), 400

    if "@" not in email or email.startswith("@") or email.endswith("@"):
        return jsonify({
            "error": "Enter a valid email address."
        }), 400

    if len(password) < 8:
        return jsonify({
            "error": "Password must contain at least 8 characters."
        }), 400

    if len(password) > 128:
        return jsonify({"error": "Password is too long."}), 400

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT GET_LOCK(%s, 10) AS lock_status",
            ("stockflow_initial_admin_setup",)
        )

        lock_result = cursor.fetchone()

        if not lock_result or lock_result["lock_status"] != 1:
            return jsonify({
                "error": "Unable to start account setup. Please try again."
            }), 503

        lock_acquired = True

        cursor.execute("SELECT COUNT(*) AS total FROM users")
        result = cursor.fetchone()

        if result["total"] > 0:
            return jsonify({
                "error": "Initial setup is already complete. Please log in."
            }), 403

        password_hash = generate_password_hash(password)

        cursor.execute("""
            INSERT INTO users (
                name, username, email, password_hash, role, is_active
            )
            VALUES (%s, %s, %s, %s, 'admin', TRUE)
        """, (name, username, email, password_hash))

        user_id = cursor.lastrowid

        record_activity(
            cursor,
            {
                "id": user_id,
                "name": name,
                "role": "admin"
            },
            "ADMIN_REGISTERED",
            "Initial admin account was created."
        )

        connection.commit()

        return jsonify({
            "message": "Initial admin account created successfully.",
            "user": {
                "id": user_id,
                "name": name,
                "username": username,
                "email": email,
                "role": "admin"
            }
        }), 201

    except mysql.connector.IntegrityError as error:
        if connection:
            connection.rollback()

        if getattr(error, "errno", None) == 1062:
            return jsonify({
                "error": "Username or email already exists."
            }), 409

        app.logger.exception("Unable to create initial user")
        return jsonify({"error": "Unable to create account."}), 500

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Unable to create initial user")
        return jsonify({"error": "Unable to create account."}), 500

    finally:
        if lock_acquired and cursor:
            try:
                cursor.execute(
                    "SELECT RELEASE_LOCK(%s)",
                    ("stockflow_initial_admin_setup",)
                )
            except Exception:
                app.logger.exception("Unable to release setup lock")

        close_db(cursor, connection)


# CREATE STAFF ACCOUNT: ADMIN ONLY

@app.route("/api/auth/staff", methods=["POST"])
@jwt_required()
@admin_required
def create_staff_account():
    connection = None
    cursor = None

    data = get_request_data()

    if data is None:
        return jsonify({"error": "Invalid request data."}), 400

    name = str(data.get("name") or "").strip()
    username = str(data.get("username") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    password = data.get("password")

    if (
        not name
        or not username
        or not email
        or not isinstance(password, str)
    ):
        return jsonify({
            "error": "Name, username, email, and password are required."
        }), 400

    if len(name) > 100 or len(username) > 50 or len(email) > 150:
        return jsonify({
            "error": "One or more fields are too long."
        }), 400

    if len(username) < 3:
        return jsonify({
            "error": "Username must contain at least 3 characters."
        }), 400

    if "@" not in email or email.startswith("@") or email.endswith("@"):
        return jsonify({
            "error": "Enter a valid email address."
        }), 400

    if len(password) < 8 or len(password) > 128:
        return jsonify({
            "error": "Password must contain 8 to 128 characters."
        }), 400

    try:
        admin_user = get_logged_in_user()

        if not admin_user or admin_user["role"] != "admin":
            return jsonify({"error": "Admin permission is required."}), 403

        connection = get_db_connection()
        cursor = connection.cursor()

        password_hash = generate_password_hash(password)

        cursor.execute("""
            INSERT INTO users (
                name, username, email, password_hash, role, is_active
            )
            VALUES (%s, %s, %s, %s, 'staff', TRUE)
        """, (name, username, email, password_hash))

        staff_id = cursor.lastrowid

        record_activity(
            cursor,
            admin_user,
            "STAFF_CREATED",
            f"Created staff account for {name} (username: {username})."
        )

        connection.commit()

        return jsonify({
            "message": "Staff account created successfully.",
            "user": {
                "id": staff_id,
                "name": name,
                "username": username,
                "email": email,
                "role": "staff"
            }
        }), 201

    except mysql.connector.IntegrityError as error:
        if connection:
            connection.rollback()

        if getattr(error, "errno", None) == 1062:
            return jsonify({
                "error": "Username or email already exists."
            }), 409

        app.logger.exception("Unable to create staff account")
        return jsonify({
            "error": "Unable to create staff account."
        }), 500

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Unable to create staff account")
        return jsonify({
            "error": "Unable to create staff account."
        }), 500

    finally:
        close_db(cursor, connection)


# LOGIN

@app.route("/api/auth/login", methods=["POST"])
def login():
    connection = None
    cursor = None

    data = get_request_data()

    if data is None:
        return jsonify({"error": "Invalid request data."}), 400

    username = str(data.get("username") or "").strip()
    password = data.get("password")

    if not username or not isinstance(password, str) or not password:
        return jsonify({
            "error": "Username and password are required."
        }), 400

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                id, name, username, email, password_hash, role, is_active
            FROM users
            WHERE username = %s
            LIMIT 1
        """, (username,))

        user = cursor.fetchone()

        if (
            not user
            or not user["is_active"]
            or not check_password_hash(user["password_hash"], password)
        ):
            return jsonify({
                "error": "Invalid username or password."
            }), 401

        record_activity(
            cursor,
            user,
            "LOGIN",
            f"{user['role'].capitalize()} user logged in successfully."
        )
        connection.commit()

        token = create_access_token(identity=str(user["id"]))

        return jsonify({
            "message": "Login successful.",
            "access_token": token,
            "user": {
                "id": user["id"],
                "name": user["name"],
                "username": user["username"],
                "email": user["email"],
                "role": user["role"]
            }
        }), 200

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Unable to log in")
        return jsonify({"error": "Unable to process login."}), 500

    finally:
        close_db(cursor, connection)


# VERIFY CURRENT LOGIN

@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def get_current_user():
    try:
        user = get_logged_in_user()

        if not user:
            return jsonify({
                "error": "User account is unavailable."
            }), 401

        user.pop("is_active", None)

        return jsonify({"user": user}), 200

    except Exception:
        app.logger.exception("Unable to verify current user")
        return jsonify({"error": "Unable to verify login."}), 500


# ==================================================
# PRODUCT APIs
# Admin can add, edit, and delete products.
# Staff can view products and change stock quantity only.
# ==================================================

# GET ALL PRODUCTS

@app.route("/api/products", methods=["GET"])
@jwt_required()
def get_products():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                id, name, sku, category, price, quantity, min_stock, created_at
            FROM products
            ORDER BY id DESC
        """)

        products = [
            serialize_row(row)
            for row in cursor.fetchall()
        ]

        return jsonify(products), 200

    except Exception:
        app.logger.exception("Unable to fetch products")
        return jsonify({"error": "Unable to load products."}), 500

    finally:
        close_db(cursor, connection)


# ADD PRODUCT: ADMIN ONLY

@app.route("/api/products", methods=["POST"])
@jwt_required()
@admin_required
def add_product():
    connection = None
    cursor = None

    data = get_request_data()

    if data is None:
        return jsonify({"error": "Invalid request data."}), 400

    name = str(data.get("name") or "").strip()
    sku = str(data.get("sku") or "").strip()
    category = str(data.get("category") or "").strip()

    price = data.get("price")
    quantity = data.get("quantity")
    min_stock = data.get("min_stock", 5)

    if not name or not sku or not category:
        return jsonify({
            "error": "Name, SKU, and category are required."
        }), 400

    if not valid_nonnegative_number(price):
        return jsonify({"error": "Enter a valid price."}), 400

    if not valid_nonnegative_number(quantity):
        return jsonify({"error": "Enter a valid quantity."}), 400

    if not valid_nonnegative_number(min_stock):
        return jsonify({"error": "Enter a valid minimum stock."}), 400

    if not float(quantity).is_integer() or not float(min_stock).is_integer():
        return jsonify({
            "error": "Quantity and minimum stock must be whole numbers."
        }), 400

    initial_quantity = int(quantity)

    try:
        admin_user = get_logged_in_user()

        if not admin_user or admin_user["role"] != "admin":
            return jsonify({"error": "Admin permission is required."}), 403

        connection = get_db_connection()
        cursor = connection.cursor()
        connection.start_transaction()

        cursor.execute("""
            INSERT INTO products (
                name, sku, category, price, quantity, min_stock
            )
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            name, sku, category, price, initial_quantity, int(min_stock)
        ))

        product_id = cursor.lastrowid

        cursor.execute("""
            INSERT IGNORE INTO categories (name)
            VALUES (%s)
        """, (category,))

        if initial_quantity > 0:
            record_stock_movement(
                cursor, product_id, name, "Stock In",
                initial_quantity, 0, initial_quantity, "Initial stock"
            )

        record_activity(
            cursor,
            admin_user,
            "PRODUCT_CREATED",
            f"Created product '{name}' (SKU: {sku}), initial quantity: {initial_quantity}."
        )

        connection.commit()

        return jsonify({
            "message": "Product added successfully.",
            "id": product_id
        }), 201

    except mysql.connector.IntegrityError as error:
        if connection:
            connection.rollback()

        if getattr(error, "errno", None) == 1062:
            return jsonify({"error": "This SKU already exists."}), 409

        app.logger.exception("Unable to add product")
        return jsonify({"error": "Unable to add product."}), 500

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Unable to add product")
        return jsonify({"error": "Unable to add product."}), 500

    finally:
        close_db(cursor, connection)


# UPDATE PRODUCT
# Admin can update all fields. Staff can update quantity only.

@app.route("/api/products/<int:product_id>", methods=["PUT"])
@jwt_required()
def update_product(product_id):
    connection = None
    cursor = None

    data = get_request_data()

    if data is None:
        return jsonify({"error": "Invalid request data."}), 400

    name = str(data.get("name") or "").strip()
    sku = str(data.get("sku") or "").strip()
    category = str(data.get("category") or "").strip()

    price = data.get("price")
    quantity = data.get("quantity")
    min_stock = data.get("min_stock", 5)

    if not name or not sku or not category:
        return jsonify({
            "error": "Name, SKU, and category are required."
        }), 400

    if not valid_nonnegative_number(price):
        return jsonify({"error": "Enter a valid price."}), 400

    if not valid_nonnegative_number(quantity):
        return jsonify({"error": "Enter a valid quantity."}), 400

    if not valid_nonnegative_number(min_stock):
        return jsonify({"error": "Enter a valid minimum stock."}), 400

    if not float(quantity).is_integer() or not float(min_stock).is_integer():
        return jsonify({
            "error": "Quantity and minimum stock must be whole numbers."
        }), 400

    new_quantity = int(quantity)

    try:
        current_user = get_logged_in_user()

        if not current_user:
            return jsonify({
                "error": "User account is unavailable. Please log in again."
            }), 401

        if current_user["role"] not in ("admin", "staff"):
            return jsonify({"error": "Your role is not permitted."}), 403

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        connection.start_transaction()

        cursor.execute("""
            SELECT
                id, name, sku, category, price, quantity, min_stock
            FROM products
            WHERE id = %s
            FOR UPDATE
        """, (product_id,))

        product = cursor.fetchone()

        if not product:
            connection.rollback()
            return jsonify({"error": "Product not found."}), 404

        previous_quantity = int(product["quantity"])

        if current_user["role"] == "staff":
            same_name = name == product["name"]
            same_sku = sku == product["sku"]
            same_category = category == product["category"]

            same_price = math.isclose(
                float(price),
                float(product["price"]),
                rel_tol=0,
                abs_tol=0.000001
            )

            same_min_stock = int(min_stock) == int(product["min_stock"])

            if not all((
                same_name, same_sku, same_category,
                same_price, same_min_stock
            )):
                connection.rollback()
                return jsonify({
                    "error": "Staff can update stock quantity only."
                }), 403

        cursor.execute("""
            UPDATE products
            SET
                name = %s,
                sku = %s,
                category = %s,
                price = %s,
                quantity = %s,
                min_stock = %s
            WHERE id = %s
        """, (
            name, sku, category, price,
            new_quantity, int(min_stock), product_id
        ))

        if new_quantity > previous_quantity:
            record_stock_movement(
                cursor, product_id, name, "Stock In",
                new_quantity - previous_quantity,
                previous_quantity, new_quantity,
                "Stock increased through product update"
            )

        elif new_quantity < previous_quantity:
            record_stock_movement(
                cursor, product_id, name, "Stock Out",
                previous_quantity - new_quantity,
                previous_quantity, new_quantity,
                "Stock decreased through product update"
            )

        cursor.execute("""
            INSERT IGNORE INTO categories (name)
            VALUES (%s)
        """, (category,))

        if new_quantity != previous_quantity:
            record_activity(
                cursor,
                current_user,
                "STOCK_UPDATED",
                f"Updated stock for '{name}' (SKU: {sku}) from {previous_quantity} to {new_quantity}."
            )

        if current_user["role"] == "admin" and any((
            name != product["name"],
            sku != product["sku"],
            category != product["category"],
            not math.isclose(
                float(price), float(product["price"]),
                rel_tol=0, abs_tol=0.000001
            ),
            int(min_stock) != int(product["min_stock"])
        )):
            record_activity(
                cursor,
                current_user,
                "PRODUCT_UPDATED",
                f"Updated product details for '{name}' (SKU: {sku})."
            )

        connection.commit()

        return jsonify({
            "message": "Product updated successfully."
        }), 200

    except mysql.connector.IntegrityError as error:
        if connection:
            connection.rollback()

        if getattr(error, "errno", None) == 1062:
            return jsonify({"error": "This SKU already exists."}), 409

        app.logger.exception("Unable to update product")
        return jsonify({"error": "Unable to update product."}), 500

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Unable to update product")
        return jsonify({"error": "Unable to update product."}), 500

    finally:
        close_db(cursor, connection)


# DELETE PRODUCT: ADMIN ONLY

@app.route("/api/products/<int:product_id>", methods=["DELETE"])
@jwt_required()
@admin_required
def delete_product(product_id):
    connection = None
    cursor = None

    try:
        admin_user = get_logged_in_user()

        if not admin_user or admin_user["role"] != "admin":
            return jsonify({"error": "Admin permission is required."}), 403

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        connection.start_transaction()

        cursor.execute("""
            SELECT id, name, sku
            FROM products
            WHERE id = %s
            FOR UPDATE
        """, (product_id,))

        product = cursor.fetchone()

        if not product:
            connection.rollback()
            return jsonify({"error": "Product not found."}), 404

        cursor.execute(
            "DELETE FROM products WHERE id = %s",
            (product_id,)
        )

        record_activity(
            cursor,
            admin_user,
            "PRODUCT_DELETED",
            f"Deleted product '{product['name']}' (SKU: {product['sku']})."
        )

        connection.commit()

        return jsonify({
            "message": "Product deleted successfully."
        }), 200

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Unable to delete product")
        return jsonify({"error": "Unable to delete product."}), 500

    finally:
        close_db(cursor, connection)


# ==================================================
# STOCK MOVEMENT HISTORY API
# ==================================================

@app.route("/api/stock-movements", methods=["GET"])
@jwt_required()
def get_stock_movements():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                id, product_id, product_name, movement_type,
                quantity, previous_quantity, new_quantity, notes, created_at
            FROM stock_movements
            ORDER BY created_at DESC, id DESC
            LIMIT 200
        """)

        movements = [
            serialize_row(row)
            for row in cursor.fetchall()
        ]

        return jsonify(movements), 200

    except Exception:
        app.logger.exception("Unable to fetch stock movement history")
        return jsonify({
            "error": "Unable to load stock movement history."
        }), 500

    finally:
        close_db(cursor, connection)


# ==================================================
# CATEGORY APIs
# ==================================================

# GET ALL CATEGORIES

@app.route("/api/categories", methods=["GET"])
@jwt_required()
def get_categories():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            INSERT IGNORE INTO categories (name)
            SELECT DISTINCT TRIM(category)
            FROM products
            WHERE category IS NOT NULL
              AND TRIM(category) <> ''
        """)

        connection.commit()

        cursor.execute("""
            SELECT
                c.id,
                c.name,
                c.created_at,
                COUNT(p.id) AS product_count
            FROM categories AS c
            LEFT JOIN products AS p
                ON TRIM(p.category) = c.name
            GROUP BY c.id, c.name, c.created_at
            ORDER BY c.name ASC
        """)

        categories = [
            serialize_row(row)
            for row in cursor.fetchall()
        ]

        return jsonify(categories), 200

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Unable to fetch categories")
        return jsonify({"error": "Unable to load categories."}), 500

    finally:
        close_db(cursor, connection)


# ADD CATEGORY: ADMIN ONLY

@app.route("/api/categories", methods=["POST"])
@jwt_required()
@admin_required
def add_category():
    connection = None
    cursor = None

    data = get_request_data()

    if data is None:
        return jsonify({"error": "Invalid request data."}), 400

    name = str(data.get("name") or "").strip()

    if not name:
        return jsonify({"error": "Category name is required."}), 400

    try:
        admin_user = get_logged_in_user()

        if not admin_user or admin_user["role"] != "admin":
            return jsonify({"error": "Admin permission is required."}), 403

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            "INSERT INTO categories (name) VALUES (%s)",
            (name,)
        )

        category_id = cursor.lastrowid

        record_activity(
            cursor,
            admin_user,
            "CATEGORY_CREATED",
            f"Created category '{name}'."
        )

        connection.commit()

        return jsonify({
            "message": "Category added successfully.",
            "id": category_id,
            "name": name
        }), 201

    except mysql.connector.IntegrityError as error:
        if connection:
            connection.rollback()

        if getattr(error, "errno", None) == 1062:
            return jsonify({
                "error": "This category already exists."
            }), 409

        app.logger.exception("Unable to add category")
        return jsonify({"error": "Unable to add category."}), 500

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Unable to add category")
        return jsonify({"error": "Unable to add category."}), 500

    finally:
        close_db(cursor, connection)


# RENAME CATEGORY: ADMIN ONLY

@app.route("/api/categories/<int:category_id>", methods=["PUT"])
@jwt_required()
@admin_required
def update_category(category_id):
    connection = None
    cursor = None

    data = get_request_data()

    if data is None:
        return jsonify({"error": "Invalid request data."}), 400

    new_name = str(data.get("name") or "").strip()

    if not new_name:
        return jsonify({"error": "Category name is required."}), 400

    try:
        admin_user = get_logged_in_user()

        if not admin_user or admin_user["role"] != "admin":
            return jsonify({"error": "Admin permission is required."}), 403

        connection = get_db_connection()
        cursor = connection.cursor()

        connection.start_transaction()

        cursor.execute("""
            SELECT name
            FROM categories
            WHERE id = %s
            FOR UPDATE
        """, (category_id,))

        category = cursor.fetchone()

        if not category:
            connection.rollback()
            return jsonify({"error": "Category not found."}), 404

        old_name = category[0]

        if old_name != new_name:
            cursor.execute("""
                SELECT id
                FROM categories
                WHERE name = %s AND id <> %s
            """, (new_name, category_id))

            if cursor.fetchone():
                connection.rollback()
                return jsonify({
                    "error": "This category name already exists."
                }), 409

            cursor.execute("""
                UPDATE products
                SET category = %s
                WHERE TRIM(category) = %s
            """, (new_name, old_name))

            cursor.execute("""
                UPDATE categories
                SET name = %s
                WHERE id = %s
            """, (new_name, category_id))

            record_activity(
                cursor,
                admin_user,
                "CATEGORY_RENAMED",
                f"Renamed category '{old_name}' to '{new_name}'."
            )

        connection.commit()

        return jsonify({
            "message": "Category updated successfully.",
            "id": category_id,
            "name": new_name
        }), 200

    except mysql.connector.IntegrityError as error:
        if connection:
            connection.rollback()

        if getattr(error, "errno", None) == 1062:
            return jsonify({
                "error": "This category name already exists."
            }), 409

        app.logger.exception("Unable to update category")
        return jsonify({"error": "Unable to update category."}), 500

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Unable to update category")
        return jsonify({"error": "Unable to update category."}), 500

    finally:
        close_db(cursor, connection)


# DELETE CATEGORY: ADMIN ONLY

@app.route("/api/categories/<int:category_id>", methods=["DELETE"])
@jwt_required()
@admin_required
def delete_category(category_id):
    connection = None
    cursor = None

    try:
        admin_user = get_logged_in_user()

        if not admin_user or admin_user["role"] != "admin":
            return jsonify({"error": "Admin permission is required."}), 403

        connection = get_db_connection()
        cursor = connection.cursor()
        connection.start_transaction()

        cursor.execute(
            "SELECT name FROM categories WHERE id = %s FOR UPDATE",
            (category_id,)
        )

        category = cursor.fetchone()

        if not category:
            connection.rollback()
            return jsonify({"error": "Category not found."}), 404

        category_name = category[0]

        cursor.execute("""
            SELECT COUNT(*)
            FROM products
            WHERE TRIM(category) = %s
        """, (category_name,))

        product_count = cursor.fetchone()[0]

        if product_count > 0:
            connection.rollback()
            return jsonify({
                "error": (
                    "This category contains products. "
                    "Move or delete those products before "
                    "deleting the category."
                )
            }), 409

        cursor.execute(
            "DELETE FROM categories WHERE id = %s",
            (category_id,)
        )

        record_activity(
            cursor,
            admin_user,
            "CATEGORY_DELETED",
            f"Deleted category '{category_name}'."
        )

        connection.commit()

        return jsonify({
            "message": "Category deleted successfully."
        }), 200

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Unable to delete category")
        return jsonify({"error": "Unable to delete category."}), 500

    finally:
        close_db(cursor, connection)


# ==================================================
# STAFF MANAGEMENT APIs
# ==================================================

# GET ALL STAFF ACCOUNTS: ADMIN ONLY

@app.route("/api/auth/staff", methods=["GET"])
@jwt_required()
@admin_required
def get_staff_accounts():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, name, username, email, role, is_active
            FROM users
            WHERE role = 'staff'
            ORDER BY id DESC
        """)

        staff_list = []

        for row in cursor.fetchall():
            staff_list.append({
                "id": row["id"],
                "name": row["name"],
                "username": row["username"],
                "email": row["email"],
                "role": row["role"],
                "is_active": bool(row["is_active"]),
            })

        return jsonify(staff_list), 200

    except Exception:
        app.logger.exception("Unable to fetch staff accounts")
        return jsonify({
            "error": "Unable to load staff accounts."
        }), 500

    finally:
        close_db(cursor, connection)


# ACTIVATE / DEACTIVATE STAFF ACCOUNT: ADMIN ONLY

@app.route("/api/auth/staff/<int:staff_id>/status", methods=["PATCH"])
@jwt_required()
@admin_required
def update_staff_status(staff_id):
    connection = None
    cursor = None

    data = get_request_data()

    if data is None:
        return jsonify({"error": "Invalid request data."}), 400

    is_active = data.get("is_active")

    if not isinstance(is_active, bool):
        return jsonify({
            "error": "is_active must be true or false."
        }), 400

    try:
        admin_user = get_logged_in_user()

        if not admin_user or admin_user["role"] != "admin":
            return jsonify({"error": "Admin permission is required."}), 403

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        connection.start_transaction()

        cursor.execute("""
            SELECT id, name, username, is_active
            FROM users
            WHERE id = %s AND role = 'staff'
            LIMIT 1
            FOR UPDATE
        """, (staff_id,))

        staff = cursor.fetchone()

        if not staff:
            connection.rollback()
            return jsonify({
                "error": "Staff account not found."
            }), 404

        old_status = bool(staff["is_active"])

        cursor.execute("""
            UPDATE users
            SET is_active = %s
            WHERE id = %s AND role = 'staff'
        """, (is_active, staff_id))

        if old_status != is_active:
            action = "STAFF_ACTIVATED" if is_active else "STAFF_DEACTIVATED"
            status_text = "activated" if is_active else "deactivated"

            record_activity(
                cursor,
                admin_user,
                action,
                f"Staff account '{staff['name']}' (username: {staff['username']}) was {status_text}."
            )

        connection.commit()

        action_text = "activated" if is_active else "deactivated"

        return jsonify({
            "message": f"Staff account {action_text} successfully.",
            "user": {
                "id": staff["id"],
                "name": staff["name"],
                "username": staff["username"],
                "is_active": is_active,
            }
        }), 200

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Unable to update staff account status")
        return jsonify({
            "error": "Unable to update staff account status."
        }), 500

    finally:
        close_db(cursor, connection)


# ==================================================
# ACTIVITY LOG API
# Only admins can read the activity log.
# ==================================================

@app.route("/api/activity-logs", methods=["GET"])
@jwt_required()
@admin_required
def get_activity_logs():
    connection = None
    cursor = None

    try:
        limit = request.args.get("limit", default=100, type=int)
        limit = max(1, min(limit or 100, 200))

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                id,
                user_id,
                user_name,
                user_role,
                action,
                description,
                created_at
            FROM activity_logs
            ORDER BY created_at DESC, id DESC
            LIMIT %s
        """, (limit,))

        logs = [
            serialize_row(row)
            for row in cursor.fetchall()
        ]

        return jsonify(logs), 200

    except Exception:
        app.logger.exception("Unable to fetch activity logs")
        return jsonify({
            "error": "Unable to load activity logs."
        }), 500

    finally:
        close_db(cursor, connection)


# ==================================================
# RUN APPLICATION
# ==================================================

if __name__ == "__main__":
    try:
        ensure_activity_logs_table()
    except Exception:
        app.logger.exception(
            "Unable to initialize activity_logs table. "
            "Check the database connection and permissions."
        )
        raise

    app.run(debug=True, port=5000)
