'''import sys
import subprocess
subprocess.check_call([sys.executable, "-m", "pip", "install", "flask"])'''


from flask import Flask, request, jsonify, render_template
import sqlite3
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, 
            template_folder=current_dir, 
            static_folder=current_dir, 
            static_url_path='')



# --- CORS ---
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return response


# --- ИНИЦИАЛИЗАЦИЯ БД ---
def init_db():
    conn = sqlite3.connect('records.db')
    c = conn.cursor()

    # Таблица рекордов
    c.execute('''CREATE TABLE IF NOT EXISTS records
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, points INTEGER)''')

    # Таблица цитат — создаётся и наполняется из db.sql
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'db.sql')
    if os.path.exists(db_path):
        with open(db_path, 'r', encoding='utf-8') as f:
            c.executescript(f.read())
        print(f"✅ Цитаты загружены из {db_path}")
    else:
        print(f"⚠️  Файл {db_path} не найден — цитаты не загружены")

    conn.commit()
    conn.close()


init_db()


# --- СТРАНИЦЫ ---
@app.route('/')
def index():
    return render_template('index.html')


# --- СОХРАНЕНИЕ РЕЗУЛЬТАТА ---
@app.route('/save_result', methods=['POST'])
def save_result():
    data = request.get_json()
    name = data.get('name')
    points = data.get('points')

    if name and points is not None:
        conn = sqlite3.connect('records.db')
        c = conn.cursor()
        c.execute("INSERT INTO records (name, points) VALUES (?, ?)", (name, points))
        conn.commit()
        conn.close()
        return jsonify({"status": "ok"})
    return jsonify({"status": "error", "message": "Invalid data"}), 400


# --- API ЦИТАТ ---

# Служебный эндпоинт: диапазон id и количество цитат
@app.route('/get_quote_count', methods=['GET'])
def get_quote_count():
    conn = sqlite3.connect('records.db')
    c = conn.cursor()
    c.execute('SELECT MIN(id), MAX(id), COUNT(*) FROM quotes')
    min_id, max_id, count = c.fetchone()
    conn.close()

    if count == 0 or min_id is None:
        return jsonify({"min_id": 0, "max_id": 0, "count": 0})
    return jsonify({"min_id": min_id, "max_id": max_id, "count": count})


# Цитата по конкретному id
@app.route('/get_quote/<int:quote_id>', methods=['GET'])
def get_quote(quote_id):
    conn = sqlite3.connect('records.db')
    c = conn.cursor()
    c.execute('SELECT id, quote FROM quotes WHERE id = ?', (quote_id,))
    row = c.fetchone()
    conn.close()

    if row:
        return jsonify({"id": row[0], "quote": row[1]})
    return jsonify({"error": "not found"}), 404


# Запасной вариант — случайная цитата силами сервера
@app.route('/get_random_quote', methods=['GET'])
def get_random_quote():
    conn = sqlite3.connect('records.db')
    c = conn.cursor()
    c.execute('SELECT id, quote FROM quotes ORDER BY RANDOM() LIMIT 1')
    row = c.fetchone()
    conn.close()

    if row:
        return jsonify({"id": row[0], "quote": row[1]})
    return jsonify({"error": "no quotes"}), 404


if __name__ == '__main__':
    app.run(debug=True)