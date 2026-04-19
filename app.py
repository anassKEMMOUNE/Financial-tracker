import sqlite3
import os
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash

app = Flask(__name__)
app.secret_key = "super-secret-key-change-in-prod"

DB_FILE = "finance.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    # Users table
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    
    # Transactions table
    c.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            subcategory TEXT,
            date TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Simple migration: just in case the transactions table existed without user_id
    try:
        c.execute('ALTER TABLE transactions ADD COLUMN user_id INTEGER DEFAULT 1')
    except sqlite3.OperationalError:
        pass # Column already exists
        
    conn.commit()
    conn.close()

if not os.path.exists(DB_FILE):
    init_db()
else:
    init_db() # Run anyway to ensure users table exists and migration runs

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

# --- Authentication ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        username = request.form['username']
        password = request.form['password']
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE username = ?", (username,))
        user = c.fetchone()
        
        if user:
            flash("Username already exists!")
            return redirect(url_for('signup'))
            
        hashed_password = generate_password_hash(password)
        c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed_password))
        conn.commit()
        conn.close()
        
        flash("Signup successful! Please log in.")
        return redirect(url_for('login'))
        
    return render_template("signup.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form['username']
        password = request.form['password']
        
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT id, password FROM users WHERE username = ?", (username,))
        user = c.fetchone()
        conn.close()
        
        if user and check_password_hash(user['password'], password):
            session['user_id'] = user['id']
            session['username'] = username
            return redirect(url_for('index'))
            
        flash("Invalid username or password!")
        return redirect(url_for('login'))
        
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.pop('user_id', None)
    session.pop('username', None)
    return redirect(url_for('login'))

# --- Main App ---
@app.route("/")
@login_required
def index():
    return render_template("index.html", username=session.get('username'))

@app.route("/api/transactions", methods=["GET", "POST"])
@login_required
def transactions():
    user_id = session['user_id']
    if request.method == "POST":
        data = request.json
        t_type = data.get("type", "expense")
        amount = data.get("amount", 0.0)
        category = data.get("category", "")
        subcategory = data.get("subcategory", "")
        date = data.get("date", "")

        conn = get_db_connection()
        c = conn.cursor()
        c.execute(
            "INSERT INTO transactions (user_id, type, amount, category, subcategory, date) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, t_type, amount, category, subcategory, date)
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "success"}), 201

    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC", (user_id,))
    rows = c.fetchall()
    conn.close()
    
    result = [dict(row) for row in rows]
    return jsonify(result)

@app.route("/api/transactions/<int:t_id>", methods=["DELETE"])
@login_required
def delete_transaction(t_id):
    user_id = session['user_id']
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM transactions WHERE id = ? AND user_id = ?", (t_id, user_id))
    conn.commit()
    conn.close()
    return jsonify({"status": "deleted"}), 200

@app.route("/sw.js")
def service_worker():
    return app.send_static_file("sw.js")

@app.route("/manifest.json")
def manifest():
    return app.send_static_file("manifest.json")

if __name__ == "__main__":
    app.run(debug=True, port=5000)
