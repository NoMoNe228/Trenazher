import sys
import subprocess
import os
import sqlite3
from flask import Flask, request, jsonify, render_template

try:
    from flask import Flask, request, jsonify, render_template
    from flask_cors import CORS
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "flask", "flask-cors"])
    from flask import Flask, request, jsonify, render_template
    from flask_cors import CORS

current_dir = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, template_folder=current_dir, static_folder=current_dir, static_url_path='')
CORS(app, resources={r"/*": {"origins": "*"}})

# ФИКС: База данных теперь всегда создается в папке game2.0 рядом с app.py
DB_PATH = os.path.join(current_dir, 'records.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS records
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, points INTEGER)''')

    db_dir = os.path.join(current_dir, 'data bases')
    
    if os.path.exists(db_dir):
        for filename in os.listdir(db_dir):
            if filename.endswith('.sql'):
                file_path = os.path.join(db_dir, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        c.executescript(f.read())
                    print(f"✅ Загружен файл: {filename}")
                except Exception as e:
                    print(f"❌ Ошибка при загрузке {filename}: {e}")
    else:
        print(f"⚠️ Папка {db_dir} не найдена!")
    
    conn.commit()
    conn.close()

init_db()

@app.route('/')
def index():
    return render_template('index.html')

# --- API ЦИТАТ ---
@app.route('/get_random_quote', methods=['GET'])
def get_random_quote():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute('SELECT text FROM quotes ORDER BY RANDOM() LIMIT 1')
        row = c.fetchone()
    except sqlite3.OperationalError:
        row = None
    finally:
        conn.close()

    if row:
        return jsonify({"quote": row[0]})
    return jsonify({"error": "No quotes found"}), 404

# --- API СЛОВ ---
@app.route('/get_random_words', methods=['GET'])
def get_random_words():
    lang = request.args.get('lang', 'ru')
    count = int(request.args.get('count', 10))
    table_name = 'words_ru' if lang == 'ru' else 'words_en'
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute(f'SELECT text FROM {table_name} ORDER BY RANDOM() LIMIT ?', (count,))
        rows = c.fetchall()
        words = [row[0] for row in rows]
        return jsonify({"words": words})
    except sqlite3.OperationalError:
        return jsonify({"error": "Table not found"}), 404
    finally:
        conn.close()

# --- НОВЫЙ API ДЛЯ КОДА ---

@app.route('/get_random_quote', methods=['GET'])
def get_random_quote():
    lang = request.args.get('lang', 'ru')
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        # В твоей базе db.sql и db1.sql пишут в одну таблицу quotes, поэтому берем случайную
        # Если нужно строго разделять - нужно переделать SQL.
        c.execute('SELECT text FROM quotes ORDER BY RANDOM() LIMIT 1')
        row = c.fetchone()
    except sqlite3.OperationalError:
        row = None
    finally:
        conn.close()

    if row:
        return jsonify({"quote": row[0]})
    return jsonify({"error": "No quotes found"}), 404
if __name__ == '__main__':
    app.run(debug=True, port=5001)