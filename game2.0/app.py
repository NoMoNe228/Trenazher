from flask import Flask, request, jsonify, render_template
import sqlite3

app = Flask(__name__, template_folder='.', static_folder='.')


# --- Ручная настройка CORS (разрешаем браузеру отправлять запросы) ---
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return response


# ---------------------------------------------------------------------

def init_db():
    # Создаем базу данных и таблицу, если их еще нет
    conn = sqlite3.connect('records.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS records
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, points INTEGER)''')
    conn.commit()
    conn.close()


init_db()  # Запускаем создание БД при старте сервера


# Главная страница (отдает твой index.html)
@app.route('/')
def index():
    return render_template('index.html')


# Страница для приема результатов
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


if __name__ == '__main__':
    app.run(debug=True)