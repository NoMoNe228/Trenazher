import sqlite3
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
db_dir = os.path.join(current_dir, 'data bases')
out_file = os.path.join(current_dir, 'data_bases.js')

# Сопоставление файлов и ключей в JS
file_to_key = {
    'db.sql': 'quotes_ru',
    'db1.sql': 'quotes_en',
    'db_words_rus.sql': 'words_ru',
    'db_words_eng.sql': 'words_en',
    'db_code_python.sql': 'code_python',
    'db_code_java.sql': 'code_java',
    'db_code_html.sql': 'code_html'
}

result = {}

for filename, key in file_to_key.items():
    filepath = os.path.join(db_dir, filename)
    if not os.path.exists(filepath):
        print(f"⚠️ Файл {filename} не найден, пропускаем")
        continue

    # Каждый файл обрабатываем в отдельной временной базе, чтобы таблицы не смешивались
    conn = sqlite3.connect(':memory:')
    c = conn.cursor()

    with open(filepath, 'r', encoding='utf-8') as f:
        c.executescript(f.read())

    # Определяем имя таблицы
    if filename in ('db.sql', 'db1.sql'):
        table = 'quotes'
    elif 'words_rus' in filename:
        table = 'words_ru'
    elif 'words_eng' in filename:
        table = 'words_en'
    elif 'python' in filename:
        table = 'python_code'
    elif 'java' in filename:
        table = 'java_code'
    elif 'html' in filename:
        table = 'html_code'
    else:
        print(f"❌ Неизвестный файл {filename}")
        conn.close()
        continue

    try:
        c.execute(f'SELECT text FROM {table}')
        rows = c.fetchall()
        result[key] = [row[0] for row in rows]
    except Exception as e:
        print(f"❌ Ошибка при чтении таблицы {table} из {filename}: {e}")

    conn.close()

# Записываем в JS
with open(out_file, 'w', encoding='utf-8') as f:
    f.write('window.FALLBACK_DATA = {\n')
    for key, items in result.items():
        f.write(f'    {key}: [\n')
        for item in items:
            # Экранируем кавычки и переносы строк для JS
            safe_item = item.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\r', '\\r')
            f.write(f'        "{safe_item}",\n')
        f.write('    ],\n')
    f.write('};\n')

print(f"✅ Файл data_bases.js успешно сгенерирован. Загружено ключей: {len(result)}")