// --- БИБЛИОТЕКА ТЕКСТОВ ---
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

function getTextForLevel() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const submode = document.getElementById('submodeSelect').value;
    const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

    if (mode === 'symbols') {
        const chars = "!@#$%^&*()_+-=[]{};':\",./<>?1234567890";
        let res = "";
        for(let i=0; i<30; i++) res += chars[Math.floor(Math.random() * chars.length)];
        return res;
    } else if (mode === 'code') {
        if (submode === 'python') return getRandom(library.code_python);
        if (submode === 'js') return getRandom(library.code_js);
        if (submode === 'html') return getRandom(library.code_html);
    } else {
        if (submode === 'ru') return getRandom(library.sentences_ru);
        if (submode === 'en') return getRandom(library.sentences_en);
    }
    return "Ошибка генерации";
}

// --- ИГРА ---
function startGame(difficulty) {
    currentDifficulty = difficulty;

    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('main-header').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';

    input = "";
    mistakes = 0;
    isGameActive = true;
    startTime = null;
    currentCombo = 0;

    document.getElementById('combo').textContent = 0;
    document.getElementById('multiplier').textContent = "1";
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('mistakes').textContent = 0;
    document.getElementById('points').textContent = 0;

    // Настройка сложности
    const timerBox = document.getElementById('timerBox');
    if (difficulty === 'easy' || difficulty === 'medium') {
        timerBox.style.display = 'none';
        timer = 9999;
    } else if (difficulty === 'hard') {
        timerBox.style.display = 'block';
        timer = 60;
        document.getElementById('timer').textContent = timer;
    }

    currentText = getTextForLevel();

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
    if (!isGameActive) return;
    if (!startTime) startTime = Date.now();
    
    const oldInputLength = input.length;
    input = e.target.value;
    
    // Если игрок что-то напечатал (добавил символ)
    if (input.length > oldInputLength) {
        const lastTyped = input[input.length - 1];
        const expected = currentText[input.length - 1];
        
        if (lastTyped !== expected) {
            // ОШИБКА
            playErrorSound();
            textContainer.classList.add('shake');
            setTimeout(() => textContainer.classList.remove('shake'), 250);
            currentCombo = 0;
            mistakes++; // <--- ВОТ ЗДЕСЬ МЫ ПРИБАВЛЯЕМ ОШИБКУ НАВСЕГДА
            document.getElementById('mistakes').textContent = mistakes; // Обновляем счетчик на экране

            if (currentDifficulty === 'medium' || currentDifficulty === 'hard') {
                endGame("Ошибка! Игра окончена.");
                return;
            }
        } else {
            // ПРАВИЛЬНО
            currentCombo++;
        }

        let multiplier = 1;
        if (currentCombo >= 50) multiplier = 5;
        else if (currentCombo >= 25) multiplier = 3;
        else if (currentCombo >= 10) multiplier = 2;

        document.getElementById('combo').textContent = currentCombo;
        document.getElementById('multiplier').textContent = multiplier;
    }

    // Обновляем текст на экране (подсветку)
    renderText();
    
    // Если текст набран до конца
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
        const timeTaken = (Date.now() - startTime) / 60000;
        const wordCount = currentText.split(" ").length;
        wpm = (timeTaken > 0) ? (wordCount / timeTaken).toFixed(2) : 0;
    }
    document.getElementById('wpm').textContent = wpm;

    let earned = 0;
    const textLength = currentText.replace(/\s/g, "").length;
    if (mistakes < textLength) {
        if (mistakes === 0) earned = 100;
        else if (mistakes <= 5) earned = 80;
        else if (mistakes <= 10) earned = 60;
        else if (mistakes <= 15) earned = 40;
        else earned = 20;
    }
    earned += Math.floor(currentCombo / 10) * 10; // Бонус за комбо

    document.getElementById('earned').textContent = earned;
    document.getElementById('points').textContent = earned;

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
    const points = parseInt(document.getElementById('earned').textContent);
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
        let userData = JSON.parse(userStr);
        userData.runs = (userData.runs || 0) + 1;
        if (points > (userData.bestScore || 0)) userData.bestScore = points;
        localStorage.setItem('currentUser', JSON.stringify(userData));
        alert(`Результат сохранен! Лучший результат: ${userData.bestScore}`);
    } else {
        alert(`Твой результат: ${points} очков. Зарегистрируйся в профиле!`);
    }
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


