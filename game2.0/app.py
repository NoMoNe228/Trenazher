import sys
import subprocess
import os
import sqlite3
from flask import Flask, request, jsonify, render_template

# Автоматическая установка зависимостей
try:
    from flask import Flask, request, jsonify, render_template
    from flask_cors import CORS
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "flask", "flask-cors"])
    from flask import Flask, request, jsonify, render_template
    from flask_cors import CORS

current_dir = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, 
            template_folder=current_dir, 
            static_folder=current_dir, 
            static_url_path='')

# Разрешаем CORS, чтобы браузер не блокировал запросы к серверу
CORS(app, resources={r"/*": {"origins": "*"}})

# --- ИНИЦИАЛИЗАЦИЯ БД ---
def init_db():
    conn = sqlite3.connect('records.db')
    c = conn.cursor()

    # Создаем таблицу рекордов
    c.execute('''CREATE TABLE IF NOT EXISTS records
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, points INTEGER)''')

    # Проверяем, существует ли таблица quotes и сколько в ней строк
    try:
        c.execute('SELECT COUNT(*) FROM quotes')
        # Извлекаем число из кортежа (например, из (0,) получаем 0)
        quotes_count = c.fetchone()[0]
    except (sqlite3.OperationalError, TypeError):
        quotes_count = 0

    # Если цитат нет вообще — жестко считываем db.sql и заполняем базу
    if quotes_count == 0:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'db.sql')
        if os.path.exists(db_path):
            with open(db_path, 'r', encoding='utf-8') as f:
                c.executescript(f.read())
            print(f"✅ База данных успешно инициализирована из {db_path}")
        else:
            print(f"⚠️ Файл {db_path} не найден!")
    else:
        print(f"ℹ️ База уже содержит цитаты ({quotes_count} шт.)")

    conn.commit()
    conn.close()

# Запускаем инициализацию при старте
init_db()

@app.route('/')
def index():
    return render_template('index.html')

# --- API ЦИТАТ ---
@app.route('/get_random_quote', methods=['GET'])
@app.route('/get_random_quote', methods=['GET'])
def get_random_quote():
    conn = sqlite3.connect('records.db')
    c = conn.cursor()
    try:
        # Явно выбираем id и text
        c.execute('SELECT id, text FROM quotes ORDER BY RANDOM() LIMIT 1')
        row = c.fetchone()  # Получаем кортеж, например: (1, "Мы то, что мы делаем...")
    except sqlite3.OperationalError:
        row = None
    finally:
        conn.close()

    if row:
        # Формируем JSON, который на 100% совпадает с ожиданиями твоего JS-кода
        return jsonify({
            "id": row[0],       # Число id
            "quote": row[1]     # Текст цитаты из колонки text
        })
        
    return jsonify({"error": "No quotes found"}), 404


if __name__ == '__main__':
    app.run(debug=True, port=5001)
