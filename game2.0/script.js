// --- БИБЛИОТЕКА ТЕКСТОВ (fallback, если сервер недоступен) ---
const library = {
    sentences_ru: [
        "Привет мир это простой тренажер печати",
        "Программирование это интересно и полезно",
        "Печатай быстро и без ошибок",
        "Смотри на экран, а не на клавиатуру"
    ],
    sentences_en: [
        "The quick brown fox jumps over the lazy dog",
        "Practice makes perfect and speed comes with time",
        "Keep your eyes on the screen not on the keys"
    ],
    code_python: [
        "def hello_world():\n    print('Hello, world!')",
        "for i in range(5):\n    print(i)",
        "numbers = [x ** 2 for x in range(10)]\nprint(sum(numbers))"
    ],
    code_js: [
        "const sum = (a, b) => a + b;\nconsole.log(sum(2, 3));",
        "for (let i = 0; i < 10; i++) {\n  console.log(i * 2);\n}"
    ],
    code_html: [
        "<div class='container'>\n  <h1>Hello</h1>\n</div>",
        "<button onclick='alert(1)'>Click me</button>"
    ]
};

// --- ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
let currentText = "";
let input = "";
let mistakes = 0;
let timer = 30;
let timerInterval = null;
let startTime = null;
let isGameActive = false;
let currentCombo = 0;
let currentDifficulty = 'easy';
let currentScore = 0; // Очки за текущую игру

const textContainer = document.getElementById('text-to-type');
const inputField = document.getElementById('hidden-input');

// --- ЗВУК ОШИБКИ ---
let audioCtx = null;
function playErrorSound() {
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "square";
        osc.frequency.value = 150;
        gain.gain.value = 0.05;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) { console.log("Аудио не работает", e); }
}

// --- КЛАВИАТУРА ---
const LAYOUTS = {
    ru: ["ё1234567890-=", "йцукенгшщзхъ\\", "фывапролджэ", "ячсмитьбю."],
    en: ["`1234567890-=", "qwertyuiop[]\\", "asdfghjkl;'", "zxcvbnm,./"]
};
const FINGERS = [
    [1,1,2,3,4,4,5,5,6,7,8,8,8], [1,2,3,4,4,5,5,6,7,8,8,8,8],
    [1,2,3,4,4,5,5,6,7,8,8,8], [1,2,3,4,4,5,5,6,7,8,8]
];

function renderKeyboard(lang) {
    const kb = document.getElementById("keyboard");
    kb.innerHTML = "";
    LAYOUTS[lang].forEach((row, r) => {
        const rowEl = document.createElement("div");
        rowEl.className = "kb-row";
        [...row].forEach((char, i) => {
            const keyEl = document.createElement("div");
            keyEl.className = `key finger-${FINGERS[r][i]}`;
            keyEl.textContent = char.toUpperCase();
            keyEl.dataset.char = char.toLowerCase();
            rowEl.appendChild(keyEl);
        });
        kb.appendChild(rowEl);
    });
    const spaceRow = document.createElement("div");
    spaceRow.className = "kb-row";
    const spaceKey = document.createElement("div");
    spaceKey.className = "key finger-4";
    spaceKey.style.width = "250px";
    spaceKey.textContent = "ПРОБЕЛ";
    spaceKey.dataset.char = " ";
    spaceRow.appendChild(spaceKey);
    kb.appendChild(spaceRow);
}

function highlightKey(char) {
    document.querySelectorAll('.key').forEach(k => k.classList.remove('active'));
    if (!char) return;
    const keyEl = document.querySelector(`.key[data-char="${char.toLowerCase()}"]`);
    if (keyEl) keyEl.classList.add('active');
}

// --- ГЕНЕРАЦИЯ ТЕКСТА ---
function updateSubmodes(mode) {
    const select = document.getElementById('submodeSelect');
    select.innerHTML = "";
    if (mode === 'sentences') {
        select.innerHTML = `<option value="ru">Русский язык</option><option value="en">English language</option>`;
    } else if (mode === 'symbols') {
        select.innerHTML = `<option value="all">Все символы</option>`;
    } else if (mode === 'code') {
        select.innerHTML = `<option value="python">Python</option><option value="js">JavaScript</option><option value="html">HTML/CSS</option>`;
    }
}

// Запрос случайной цитаты с сервера
async function fetchRandomQuote() {
    // ✅ Вариант 1: quotes.js загружен — берём из локального массива.
    // Работает при открытии index.html двойным кликом (file://).
    if (Array.isArray(window.QUOTES) && window.QUOTES.length > 0) {
        const randomIndex = Math.floor(Math.random() * window.QUOTES.length);
        const picked = window.QUOTES[randomIndex];
        console.log('📖 Цитата из quotes.js:', picked.id, '—', picked.quote);
        return picked.quote;
    }
}

async function getTextForLevel() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const submode = document.getElementById('submodeSelect').value;
    const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

    if (mode === 'symbols') {
        const chars = "!@#$%^&*()_+-=[]{};':\",./<>?1234567890";
        let res = "";
        for (let i = 0; i < 30; i++) res += chars[Math.floor(Math.random() * chars.length)];
        return res;
    } else if (mode === 'code') {
        if (submode === 'python') return getRandom(library.code_python);
        if (submode === 'js')     return getRandom(library.code_js);
        if (submode === 'html')   return getRandom(library.code_html);
    } else {
        if (submode === 'ru') {
            const quote = await fetchRandomQuote();       // ← из БД
            if (quote) return quote;
            return getRandom(library.sentences_ru);       // ← fallback
        }
        if (submode === 'en') return getRandom(library.sentences_en);
    }
    return "Ошибка генерации";
}

// --- ИГРА ---
async function startGame(difficulty) {
    currentDifficulty = difficulty;

    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('main-header').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';

    input = "";
    mistakes = 0;
    isGameActive = false;    // заблокируем ввод, пока грузится цитата
    startTime = null;
    currentCombo = 0;

    document.getElementById('combo').textContent = 0;
    document.getElementById('multiplier').textContent = "1";
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('mistakes').textContent = 0;
        currentScore = 0;
    document.getElementById('points').textContent = currentScore;
    document.getElementById('points').textContent = 0;

    const timerBox = document.getElementById('timerBox');
    if (difficulty === 'easy' || difficulty === 'medium') {
        timerBox.style.display = 'none';
        timer = 9999;
    } else if (difficulty === 'hard') {
        timerBox.style.display = 'block';
        timer = 60;
        document.getElementById('timer').textContent = timer;
    }

    currentText = await getTextForLevel();   // ← ждём цитату с сервера
    isGameActive = true;                     // теперь можно печатать

    renderText();
    renderKeyboard('ru');
    inputField.value = "";
    inputField.focus();

    if (timerInterval) clearInterval(timerInterval);
    if (difficulty === 'hard') {
        timerInterval = setInterval(() => {
            if (timer > 0) {
                timer--;
                document.getElementById('timer').textContent = timer;
            } else {
                endGame("Время вышло!");
            }
        }, 1000);
    }
}

function renderText() {
    textContainer.innerHTML = '';
    for (let i = 0; i < currentText.length; i++) {
        const span = document.createElement('span');
        span.textContent = currentText[i];
        if (i < input.length) {
            if (input[i] === currentText[i]) span.className = 'correct';
            else span.className = 'incorrect';
        } else if (i === input.length) {
            span.className = 'current';
        }
        textContainer.appendChild(span);
    }
    if (input.length < currentText.length) {
        highlightKey(currentText[input.length]);
    }
}

inputField.addEventListener('input', (e) => {
    if (!isGameActive) { e.target.value = input; return; }
    if (!startTime) startTime = Date.now();

    const oldInputLength = input.length;
    input = e.target.value;

    if (input.length > oldInputLength) {
        const lastTyped = input[input.length - 1];
        const expected = currentText[input.length - 1];

                if (lastTyped !== expected) {
            // ОШИБКА
            playErrorSound();
            textContainer.classList.add('shake');
            setTimeout(() => textContainer.classList.remove('shake'), 250);
            currentCombo = 0;
            mistakes++;
            document.getElementById('mistakes').textContent = mistakes;

            // Если уровень сложный или нормальный - вылетаем
            if (currentDifficulty === 'medium' || currentDifficulty === 'hard') {
                endGame("Ошибка! Игра окончена.");
                return;
            }
        } else {
            // ПРАВИЛЬНО
            currentCombo++;

            // --- НОВОЕ: Начисление очков за правильную букву ---
            let mult = 1;
            if (currentCombo >= 50) mult = 5;
            else if (currentCombo >= 25) mult = 3;
            else if (currentCombo >= 10) mult = 2;

            currentScore += (1 * mult); // 1 очко умножаем на комбо
            document.getElementById('points').textContent = currentScore;
        }

        let multiplier = 1;
        if (currentCombo >= 50) multiplier = 5;
        else if (currentCombo >= 25) multiplier = 3;
        else if (currentCombo >= 10) multiplier = 2;

        document.getElementById('combo').textContent = currentCombo;
        document.getElementById('multiplier').textContent = multiplier;
    }

    renderText();

    if (input.length >= currentText.length) {
        endGame("Текст набран!");
    }
});

inputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (input.length > 0) endGame("Вы прервали игру!");
    }
});

function endGame(reason) {
    isGameActive = false;
    clearInterval(timerInterval);

    document.getElementById('game-over-reason').textContent = reason;

    let wpm = 0;
    if (startTime) {
        const timeTakenMs = Date.now() - startTime;
        if (timeTakenMs > 1000) {
            const timeTakenMin = timeTakenMs / 60000;
            const wordCount = currentText.split(" ").length;
            wpm = (wordCount / timeTakenMin).toFixed(2);
        }
    }
    document.getElementById('wpm').textContent = wpm;

    // Показываем заработанные за эту игру очки
    document.getElementById('earned').textContent = currentScore;

    // Загружаем общий счет игрока
    const userStr = localStorage.getItem('currentUser');
    let total = 0;
    if (userStr) {
        let userData = JSON.parse(userStr);
        total = userData.totalScore || 0;
    }
    document.getElementById('total-points').textContent = total;

    document.getElementById('game-over').style.display = 'block';
    document.querySelectorAll('.key').forEach(k => k.classList.remove('active'));
}

function restartGame() {
    document.getElementById('start-screen').style.display = 'block';
    document.getElementById('main-header').style.display = 'flex';
    document.getElementById('game-screen').style.display = 'none';
    clearInterval(timerInterval);
    isGameActive = false;
}

// --- ПРОФИЛЬ ---
function openProfile() {
    document.getElementById('profile-modal').style.display = 'flex';
    checkLogin();
}
function closeProfile() {
    document.getElementById('profile-modal').style.display = 'none';
}
function checkLogin() {
    const user = localStorage.getItem('currentUser');
    if (user) {
        const userData = JSON.parse(user);
        document.getElementById('auth-form').style.display = 'none';
        document.getElementById('user-profile').style.display = 'block';
        document.getElementById('profile-name').textContent = userData.name;
        document.getElementById('profile-best').textContent = userData.bestScore || 0;
        document.getElementById('profile-total').textContent = userData.totalScore || 0;
        document.getElementById('profile-runs').textContent = userData.runs || 0;
    } else {
        document.getElementById('auth-form').style.display = 'block';
        document.getElementById('user-profile').style.display = 'none';
    }
}
function loginUser() {
    const name = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    if (!name || !pass) { alert("Заполни все поля!"); return; }
    const userData = { name: name, bestScore: 0, runs: 0 };
    localStorage.setItem('currentUser', JSON.stringify(userData));
    alert(`Успешный вход! Привет, ${name}!`);
    checkLogin();
}
function logoutUser() {
    localStorage.removeItem('currentUser');
    checkLogin();
}
function saveResult() {
    const userStr = localStorage.getItem('currentUser');

    if (userStr) {
        let userData = JSON.parse(userStr);

        // Прибавляем очки за эту игру к общему счету
        userData.totalScore = (userData.totalScore || 0) + currentScore;
        userData.runs = (userData.runs || 0) + 1;

        // Обновляем лучший результат за одну игру
        if (currentScore > (userData.bestScore || 0)) {
            userData.bestScore = currentScore;
        }

        localStorage.setItem('currentUser', JSON.stringify(userData));
        alert(`Результат сохранен! Всего очков в профиле: ${userData.totalScore}`);
    } else {
        alert(`Твой результат: ${currentScore} очков. Зарегистрируйся в профиле, чтобы копить очки!`);
    }

    // Обновляем окно профиля, если оно открыто
    checkLogin();
    restartGame();
}

// --- ТЕМА ---
function toggleTheme() {
    const body = document.body;
    body.classList.toggle('light-theme');
    const btn = document.getElementById('themeBtn');
    if (body.classList.contains('light-theme')) {
        btn.textContent = "☀️ Сменить тему";
        localStorage.setItem('theme', 'light');
    } else {
        btn.textContent = "🌙 Сменить тему";
        localStorage.setItem('theme', 'dark');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || !savedTheme) {
        document.body.classList.add('light-theme');
        document.getElementById('themeBtn').textContent = "☀️ Сменить тему";
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove('light-theme');
        document.getElementById('themeBtn').textContent = "🌙 Сменить тему";
    }
});
// Играть еще раз (возвращает к выбору сложности)


// Заглушка для статистики (сделаем позже)
function openStats() {
    alert("Статистика появится в следующем обновлении! (Тут будет твой график)");
}
// Открыть окно рестарта
function playAgain() {
    document.getElementById('restart-modal').style.display = 'flex';

    // Синхронизируем выпадающие списки с тем, что было выбрано в главном меню
    const mainMode = document.querySelector('input[name="mode"]:checked').value;
    document.getElementById('restartMode').value = mainMode;

    // Обновляем подрежимы при открытии
    updateRestartSubmodes(mainMode);
}

// Закрыть окно рестарта
function closeRestart() {
    document.getElementById('restart-modal').style.display = 'none';
}

// Обновление подрежимов в окне рестарта
function updateRestartSubmodes(mode) {
    const select = document.getElementById('restartSubmode');
    select.innerHTML = "";
    if (mode === 'sentences') {
        select.innerHTML = `<option value="ru">Русский язык</option><option value="en">English language</option>`;
    } else if (mode === 'symbols') {
        select.innerHTML = `<option value="all">Все символы</option>`;
    } else if (mode === 'code') {
        select.innerHTML = `<option value="python">Python</option><option value="js">JavaScript</option><option value="html">HTML/CSS</option>`;
    }
}

// Обработчик смены режима в окне рестарта
document.getElementById('restartMode').addEventListener('change', (e) => {
    updateRestartSubmodes(e.target.value);
});

// Быстрый старт с выбранными настройками
function quickStart(difficulty) {
    closeRestart();

    // Обновляем радио-кнопки и главный селект, чтобы game знал, что мы выбрали
    const mode = document.getElementById('restartMode').value;
    document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;

    // Вызываем updateSubmodes для главного меню (чтобы там тоже обновилось)
    updateSubmodes(mode);

    // Устанавливаем подрежим в главном меню (чтобы getTextForLevel взял нужный)
    const submode = document.getElementById('restartSubmode').value;
    document.getElementById('submodeSelect').value = submode;

    // Запускаем игру
    startGame(difficulty);
}
