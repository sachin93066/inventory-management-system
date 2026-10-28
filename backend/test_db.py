
from db import get_db_connection

try:
    connection = get_db_connection()

    if connection.is_connected():
        print("MySQL connected successfully!")

    cursor = connection.cursor()
    cursor.execute("SELECT DATABASE()")
    print("Database:", cursor.fetchone()[0])

    cursor.close()
    connection.close()

except Exception as error:
    print("Database connection failed:", error)
