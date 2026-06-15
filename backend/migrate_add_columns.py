#!/usr/bin/env python3
"""
Migration script to add CustomerCategory and InquiryDate columns to existing database.
Run this if you get "no such column" errors after upgrading the schema.
"""
import sqlite3

db_path = "./inquiry_ms.db"

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Add CustomerCategory to Customers table
    try:
        cursor.execute("ALTER TABLE Customers ADD COLUMN CustomerCategory VARCHAR(50) DEFAULT 'Not Identified'")
        print("[OK] Added CustomerCategory column to Customers table")
    except sqlite3.OperationalError as e:
        if "already exists" in str(e):
            print("[OK] CustomerCategory column already exists")
        else:
            print("[ERROR] Error adding CustomerCategory: {}".format(e))

    # Add InquiryDate to Inquiries table
    try:
        cursor.execute("ALTER TABLE Inquiries ADD COLUMN InquiryDate DATETIME")
        print("[OK] Added InquiryDate column to Inquiries table")
    except sqlite3.OperationalError as e:
        if "already exists" in str(e):
            print("[OK] InquiryDate column already exists")
        else:
            print("[ERROR] Error adding InquiryDate: {}".format(e))

    conn.commit()
    conn.close()
    print("\nMigration complete!")

except Exception as e:
    print("[ERROR] {}".format(e))
    import traceback
    traceback.print_exc()
