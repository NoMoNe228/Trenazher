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
    words_ru: [
        "дом", "мир", "рука", "окно", "книга", "лампа", "солнце", "клавиша", 
        "скорость", "точность", "печать", "герой", "палец", "строка", "уровень", 
        "победа", "ракета", "дорога", "ветер", "звезда", "огонь", "время", "кот", "лес"
    ],
    words_en: [
        "home", "world", "hand", "book", "light", "sun", "keyboard", "speed", 
        "focus", "typing", "hero", "finger", "level", "rocket", "road", "star", 
        "fire", "time", "water", "green", "quick", "brown", "fox", "jumps", "lazy"
    ],
    code_python: [
        "def hello_world(): print('Hello, world!')",
        "for i in range(5): print(i)",
        "numbers = [x ** 2 for x in range(10)] print(sum(numbers))"
    ],
    code_js: [
        "const sum = (a, b) => a + b; console.log(sum(2, 3));",
        "for (let i = 0; i < 10; i++) {console.log(i * 2);}"
    ],
    code_html: [
        "<div class='container'><h1>Hello</h1></div>",
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
let currentScore = 0; 
let currentSessionErrors = {}; // Сбор ошибок за текущую игру

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
    
    const currentMode = document.querySelector('input[name="mode"]:checked').value;
    
    // В режиме кода всегда английская раскладка, в остальных - выбранная
    let actualLang = lang;
    if (currentMode === 'code') {
        actualLang = 'en';
    }

    // Карта символов для Shift (чтобы нарисовать их на клавишах сверху)
    const SHIFT_MAP = {
        '`': '~', '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')', '-': '_', '=': '+',
        '[': '{', ']': '}', '\\': '|',
        ';': ':', "'": '"', ',': '<', '.': '>', '/': '?'
    };

    LAYOUTS[actualLang].forEach((row, r) => {
        const rowEl = document.createElement("div");
        rowEl.className = "kb-row";
        
        [...row].forEach((char, i) => {
            const keyEl = document.createElement("div");
            keyEl.className = `key finger-${FINGERS[r][i]}`;
            
            // Если у клавиши есть символ с Shift, рисуем его сверху мелким шрифтом
            if (SHIFT_MAP[char]) {
                const topSpan = document.createElement("span");
                topSpan.className = "key-top";
                topSpan.textContent = SHIFT_MAP[char];
                keyEl.appendChild(topSpan);
            }
            
            // Основная надпись (буква или цифра)
            const mainSpan = document.createElement("span");
            mainSpan.className = "key-main";
            mainSpan.textContent = char.toUpperCase();
            keyEl.appendChild(mainSpan);
            
            // Сохраняем данные для подсветки
            keyEl.dataset.char = char.toLowerCase();
            if (SHIFT_MAP[char]) {
                keyEl.dataset.shift = SHIFT_MAP[char];
            }
            
            rowEl.appendChild(keyEl);
        });
        kb.appendChild(rowEl);
    });

    // Пробел
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
    
    // Сначала ищем по точному совпадению символа (например, '@')
    let keyEl = document.querySelector(`.key[data-shift="${char}"]`);
    
    // Если не нашли (например, это просто буква или цифра), ищем по основному символу
    if (!keyEl) {
        keyEl = document.querySelector(`.key[data-char="${char.toLowerCase()}"]`);
    }
    
    if (keyEl) keyEl.classList.add('active');
}

// --- ГЕНЕРАЦИЯ ТЕКСТА ---
function updateSubmodes(mode) {
    const select = document.getElementById('submodeSelect');
    select.innerHTML = "";
    if (mode === 'sentences' || mode === 'words') {
        select.innerHTML = `<option value="ru">Русский язык</option><option value="en">English language</option>`;
    } else if (mode === 'symbols') {
        select.innerHTML = `<option value="all">Все символы</option>`;
    } else if (mode === 'code') {
        select.innerHTML = `<option value="python">Python</option><option value="js">JavaScript</option><option value="html">HTML/CSS</option>`;
    }
}

async function fetchRandomQuote() {
    try {
        const response = await fetch('http://localhost:5001/get_random_quote');
        if (!response.ok) throw new Error(`Сервер вернул статус ${response.status}`);
        const data = await response.json();
        if (data && typeof data.quote === 'string') return data.quote; 
    } catch (error) {
        console.warn('⚠️ Не удалось получить цитату с сервера:', error.message);
    }
    return null; 
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
    } else if (mode === 'words') {
        let wordList = (submode === 'ru') ? library.words_ru : library.words_en;
        let result = [];
        for (let i = 0; i < 10; i++) result.push(getRandom(wordList));
        return result.join(" ");
    } else {
        if (submode === 'ru') {
            const quote = await fetchRandomQuote();
            if (quote) return quote;
            return getRandom(library.sentences_ru);
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
    isGameActive = false; 
    startTime = null;
    currentCombo = 0;
    currentScore = 0;
    currentSessionErrors = {}; // Очищаем ошибки для новой игры

    document.getElementById('combo').textContent = 0;
    document.getElementById('multiplier').textContent = "1";
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('mistakes').textContent = 0;
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

    currentText = await getTextForLevel(); 
    isGameActive = true;                     

    renderText();
    let kbLang = 'ru';
    if (document.querySelector('input[name="mode"]:checked').value === 'code') {
        kbLang = 'en';
    } else if (document.getElementById('submodeSelect').value === 'en') {
        kbLang = 'en';
    }
    renderKeyboard(kbLang);
    
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

            // Сбор статистики по буквам
            currentSessionErrors[expected] = (currentSessionErrors[expected] || 0) + 1;

            if (currentDifficulty === 'medium' || currentDifficulty === 'hard') {
                endGame("Ошибка! Игра окончена.");
                return;
            }
        } else {
            // ПРАВИЛЬНО
            currentCombo++;
            let mult = 1;
            if (currentCombo >= 50) mult = 5;
            else if (currentCombo >= 25) mult = 3;
            else if (currentCombo >= 10) mult = 2;

            currentScore += (1 * mult);
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

    // --- Правильный расчёт WPM ---
    // Считаем по фактически набранным символам, а не по длине всего текста.
    // Формула: (правильные символы / 5) / минуты
    let wpm = 0;
    let correctChars = 0;
    if (startTime && currentText) {
        const timeTakenMin = (Date.now() - startTime) / 60000;
        for (let i = 0; i < input.length; i++) {
            if (input[i] === currentText[i]) correctChars++;
        }
        if (timeTakenMin > 0 && correctChars > 0) {
            wpm = (correctChars / 5 / timeTakenMin).toFixed(2);
        }
    }
    document.getElementById('wpm').textContent = wpm;

    document.getElementById('earned').textContent = currentScore;

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
    const userData = { name: name, bestScore: 0, runs: 0, totalScore: 0, totalTime: 0, hardLetters: {} };
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

        userData.totalScore = (userData.totalScore || 0) + currentScore;
        userData.runs = (userData.runs || 0) + 1;

        if (currentScore > (userData.bestScore || 0)) {
            userData.bestScore = currentScore;
        }

        const timeTaken = startTime ? (Date.now() - startTime) / 1000 : 0;
        userData.totalTime = (userData.totalTime || 0) + timeTaken;

        userData.lastWpm = document.getElementById('wpm').textContent;
        const totalTyped = input.length;
        const accuracy = totalTyped > 0 ? Math.round(((totalTyped - mistakes) / totalTyped) * 100) : 100;
        userData.lastAccuracy = accuracy;

        if (!userData.hardLetters) userData.hardLetters = {};
        for (let char in currentSessionErrors) {
            userData.hardLetters[char] = (userData.hardLetters[char] || 0) + currentSessionErrors[char];
        }

        localStorage.setItem('currentUser', JSON.stringify(userData));
        alert(`Результат сохранен! Всего очков: ${userData.totalScore}`);
    } else {
        alert(`Твой результат: ${currentScore} очков. Войди в профиль, чтобы копить статистику!`);
    }

    checkLogin();
    restartGame();
}

// --- ТЕМА ---
function toggleTheme() {
    const body = document.body;
    body.classList.toggle('light-theme');
    const btn = document.getElementById('themeBtn');
    if (body.classList.contains('light-theme')) {
        btn.textContent = "Сменить тему";
        localStorage.setItem('theme', 'light');
    } else {
        btn.textContent = "Сменить тему";
        localStorage.setItem('theme', 'dark');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || !savedTheme) {
        document.body.classList.add('light-theme');
        document.getElementById('themeBtn').textContent = "Сменить тему";
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove('light-theme');
        document.getElementById('themeBtn').textContent = "Сменить тему";
    }
});

// --- РЕСТАРТ ---
function playAgain() {
    document.getElementById('restart-modal').style.display = 'flex';
    const mainMode = document.querySelector('input[name="mode"]:checked').value;
    document.getElementById('restartMode').value = mainMode;
    updateRestartSubmodes(mainMode);
}

function closeRestart() {
    document.getElementById('restart-modal').style.display = 'none';
}

function updateRestartSubmodes(mode) {
    const select = document.getElementById('restartSubmode');
    select.innerHTML = "";
    if (mode === 'sentences' || mode === 'words') {
        select.innerHTML = `<option value="ru">Русский язык</option><option value="en">English language</option>`;
    } else if (mode === 'symbols') {
        select.innerHTML = `<option value="all">Все символы</option>`;
    } else if (mode === 'code') {
        select.innerHTML = `<option value="python">Python</option><option value="js">JavaScript</option><option value="html">HTML/CSS</option>`;
    }
}

document.getElementById('restartMode').addEventListener('change', (e) => {
    updateRestartSubmodes(e.target.value);
});

function quickStart(difficulty) {
    closeRestart();
    const mode = document.getElementById('restartMode').value;
    document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
    updateSubmodes(mode);
    const submode = document.getElementById('restartSubmode').value;
    document.getElementById('submodeSelect').value = submode;
    startGame(difficulty);
}

// --- СТАТИСТИКА ---
function openStats() {
    document.getElementById('stats-modal').style.display = 'flex';
    
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
        document.getElementById('stats-auth-warning').style.display = 'block';
        document.getElementById('stats-content').style.display = 'none';
        return;
    }
    
    document.getElementById('stats-auth-warning').style.display = 'none';
    document.getElementById('stats-content').style.display = 'block';
    
    const user = JSON.parse(userStr);
    
    document.getElementById('stat-total-runs').textContent = user.runs || 0;
    document.getElementById('stat-total-time').textContent = Math.round((user.totalTime || 0) / 60);
    document.getElementById('stat-total-score').textContent = user.totalScore || 0;
    
    document.getElementById('stat-last-wpm').textContent = user.lastWpm || 0;
    document.getElementById('stat-last-accuracy').textContent = (user.lastAccuracy || 0) + "%";
    
    const hardLetters = user.hardLetters || {};
    const sorted = Object.entries(hardLetters).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    if (sorted.length > 0) {
        document.getElementById('stat-hard-letters').textContent = sorted.map(([char, count]) => `"${char}" (${count})`).join(", ");
    } else {
        document.getElementById('stat-hard-letters').textContent = "Ошибок пока нет!";
    }
}

function closeStats() {
    document.getElementById('stats-modal').style.display = 'none';
}
// --- ДОСТИЖЕНИЯ ---
const achievementsList = [
    { id: "first_game", title: "Первый шаг", desc: "Завершить первую тренировку", icon: "🚀" },
    { id: "combo_10", title: "В ударе", desc: "Достичь комбо x2 (10 символов подряд)", icon: "🔥" },
    { id: "combo_50", title: "Машина", desc: "Достичь комбо x5 (50 символов подряд)", icon: "⚡" },
    { id: "wpm_60", title: "Скорострел", desc: "Достичь скорости 60 слов/мин", icon: "🏎️" },
    { id: "wpm_100", title: "Печатный гений", desc: "Достичь скорости 100 слов/мин", icon: "🧠" },
    { id: "no_mistakes", title: "Снайпер", desc: "Завершить текст без единой ошибки", icon: "🎯" },
    { id: "code_master", title: "Кодер", desc: "Пройти тренировку в режиме «Код»", icon: "💻" },
    { id: "polyglot", title: "Полиглот", desc: "Сыграть на русском и английском языках", icon: "🌍" },
    { id: "marathon", title: "Марафонец", desc: "Провести 10 тренировок", icon: "🏃" },
    { id: "rich", title: "Богач", desc: "Накопить 1000 очков", icon: "💎" }
];

function checkAchievements() {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return;

    let userData = JSON.parse(userStr);
    if (!userData.achievements) userData.achievements = [];
    
    let newAchievements = [];
    const currentMode = document.querySelector('input[name="mode"]:checked').value;
    const currentLang = document.getElementById('submodeSelect').value;
    const wpm = parseFloat(document.getElementById('wpm').textContent) || 0;

    // Проверяем условия
    if (userData.runs >= 1 && !userData.achievements.includes("first_game")) newAchievements.push("first_game");
    if (currentCombo >= 10 && !userData.achievements.includes("combo_10")) newAchievements.push("combo_10");
    if (currentCombo >= 50 && !userData.achievements.includes("combo_50")) newAchievements.push("combo_50");
    if (wpm >= 60 && !userData.achievements.includes("wpm_60")) newAchievements.push("wpm_60");
    if (wpm >= 100 && !userData.achievements.includes("wpm_100")) newAchievements.push("wpm_100");
    if (mistakes === 0 && window.lastGameReason === "Текст набран!" && !userData.achievements.includes("no_mistakes")) newAchievements.push("no_mistakes");
    if (currentMode === 'code' && !userData.achievements.includes("code_master")) newAchievements.push("code_master");
    if (userData.runs >= 10 && !userData.achievements.includes("marathon")) newAchievements.push("marathon");
    if (userData.totalScore >= 1000 && !userData.achievements.includes("rich")) newAchievements.push("rich");

    // Полиглот
    if (!userData.langsPlayed) userData.langsPlayed = [];
    if (!userData.langsPlayed.includes(currentLang) && currentLang !== 'all' && currentMode !== 'code') {
        userData.langsPlayed.push(currentLang);
    }
    if (userData.langsPlayed.length >= 2 && !userData.achievements.includes("polyglot")) {
        newAchievements.push("polyglot");
    }

    if (newAchievements.length > 0) {
        newAchievements.forEach(id => userData.achievements.push(id));
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        setTimeout(() => {
            alert(`🏆 Новое достижение!\n\n${newAchievements.map(id => {
                const ach = achievementsList.find(a => a.id === id);
                return `${ach.icon} ${ach.title}`;
            }).join('\n')}`);
        }, 500);
    }
}

function openAchievements() {
    document.getElementById('achievements-modal').style.display = 'flex';
    
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
        document.getElementById('achievements-auth-warning').style.display = 'block';
        document.getElementById('achievements-list').style.display = 'none';
        return;
    }
    
    document.getElementById('achievements-auth-warning').style.display = 'none';
    document.getElementById('achievements-list').style.display = 'grid';
    
    const user = JSON.parse(userStr);
    const unlocked = user.achievements || [];
    const listContainer = document.getElementById('achievements-list');
    listContainer.innerHTML = "";

    achievementsList.forEach(ach => {
        const isUnlocked = unlocked.includes(ach.id);
        const card = document.createElement('div');
        card.style.background = isUnlocked ? "#0ea5e9" : "#0f172a";
        card.style.border = isUnlocked ? "1px solid #38bdf8" : "1px solid #334155";
        card.style.padding = "15px";
        card.style.display = "flex";
        card.style.alignItems = "center";
        card.style.gap = "15px";
        card.style.opacity = isUnlocked ? "1" : "0.5";
        
        card.innerHTML = `
            <div style="font-size: 30px;">${isUnlocked ? ach.icon : "🔒"}</div>
            <div>
                <div style="font-weight: bold; color: ${isUnlocked ? '#fff' : '#94a3b8'}; margin-bottom: 5px;">${ach.title}</div>
                <div style="font-size: 12px; color: ${isUnlocked ? '#e2e8f0' : '#64748b'};">${ach.desc}</div>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

function closeAchievements() {
    document.getElementById('achievements-modal').style.display = 'none';
}
}
