const texts = [
    "Привет мир это простой тренажер печати",
    "Программирование это интересно и полезно",
    "Печатай быстро и без ошибок"
];

let currentText = "";
let input = "";
let mistakes = 0;
let timer = 30;
let timerInterval = null;
let startTime = null;
let isGameActive = false;
let currentCombo = 0;
let currentLevel = 1;

const textContainer = document.getElementById('text-to-type');
const inputField = document.getElementById('hidden-input');

// --- НОВОЕ: АУДИО (Звук ошибки) ---
let audioCtx = null;
function playErrorSound() {
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "square";
        osc.frequency.value = 150; // Низкий звук
        gain.gain.value = 0.05; // Тихая громкость
        osc.connect(gain); 
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1); // 0.1 секунды
    } catch (e) { console.log("Аудио не работает", e); }
}

// --- НОВОЕ: РИСУЕМ КЛАВИАТУРУ ---
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
    const keyEl = document.querySelector(`.key[data-char="${char.toLowerCase()}"]`);
    if (keyEl) keyEl.classList.add('active');
}


function startGame(level) {

    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
        currentCombo = 0;
    document.getElementById('combo').textContent = currentCombo;
    document.getElementById('multiplier').textContent = "1";

    input = "";
    mistakes = 0;
    timer = 30;
    isGameActive = true;
    startTime = null;

    document.getElementById('timer').textContent = timer;
    document.getElementById('mistakes').textContent = mistakes;
    document.getElementById('points').textContent = 0;
    document.getElementById('game-over').style.display = 'none';

    // 3. Генерируем текст в зависимости от уровня
    if (level === 'infinite') {
        currentText = "Бесконечный режим пока в разработке... (нажми Esc)";
    } else if (level === 'easy') {
        currentText = "Привет мир это простой тренажер печати";
    } else if (level === 'hard') {
        currentText = "def hello_world():\n    print('Hello!')";
    }

    renderText();
    renderKeyboard('ru');
    inputField.value = "";
    inputField.focus();

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (timer > 0) {
            timer--;
            document.getElementById('timer').textContent = timer;
        } else {
            endGame();
        }
    }, 1000);
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

        // Если добавили символ (не удалили)
    if (input.length > oldInputLength) {
        const lastTyped = input[input.length - 1];
        const expected = currentText[input.length - 1];

        if (lastTyped !== expected) {
            // ОШИБКА: сбрасываем комбо
            playErrorSound();
            textContainer.classList.add('shake');
            setTimeout(() => textContainer.classList.remove('shake'), 250);
            currentCombo = 0;
        } else {
            // ПРАВИЛЬНО: увеличиваем комбо
            currentCombo++;
        }

        // Обновляем отображение комбо и множителя
        let multiplier = 1;
        if (currentCombo >= 50) multiplier = 5;
        else if (currentCombo >= 25) multiplier = 3;
        else if (currentCombo >= 10) multiplier = 2;

        document.getElementById('combo').textContent = currentCombo;
        document.getElementById('multiplier').textContent = multiplier;

        // Меняем цвет комбо в зависимости от множителя (через inline-стили)
        const comboEl = document.getElementById('combo').parentElement;
        if (multiplier === 2) comboEl.style.color = "#60a5fa"; // Синий
        else if (multiplier === 3) comboEl.style.color = "#a855f7"; // Фиолетовый
        else if (multiplier === 5) comboEl.style.color = "#ef4444"; // Красный
        else comboEl.style.color = "#fff"; // Белый
    }

    // Считаем ошибки (как раньше)
    let currentMistakes = 0;
    for (let i = 0; i < input.length; i++) {
        if (input[i] !== currentText[i]) currentMistakes++;
    }
    mistakes = currentMistakes;
    document.getElementById('mistakes').textContent = mistakes;

    renderText();

    if (input.length >= currentText.length) endGame();

    renderText();

    if (input.length >= currentText.length) endGame();
});

function endGame() {
    isGameActive = false;
    clearInterval(timerInterval);

    let wpm = 0;
    if (startTime) {
        const timeTaken = (Date.now() - startTime) / 60000;
        const wordCount = currentText.split(" ").length;
        wpm = (wordCount / timeTaken).toFixed(2);
    }
    document.getElementById('wpm').textContent = wpm;

        // Считаем очки с учетом сложности
    let earned = 0;
    const textLength = currentText.replace(/\s/g, "").length;

    // Базовые очки за текст
    if (mistakes < textLength) {
        if (mistakes === 0) earned = 100;
        else if (mistakes <= 5) earned = 80;
        else if (mistakes <= 10) earned = 60;
        else if (mistakes <= 15) earned = 40;
        else earned = 20;
    }

    // Добавляем бонус за комбо (например, +10 очков за каждые 10 комбо)
    earned += Math.floor(currentCombo / 10) * 10;

    // Показываем результат
    document.getElementById('earned').textContent = earned;
    document.getElementById('points').textContent = earned;

    // --- СИСТЕМА УРОВНЕЙ ---
    // Чтобы получить новый уровень, нужно набрать много очков.
    // Уровень 1 = 0 очков, Уровень 2 = 100 очков, Уровень 3 = 300 очков.
    // Для хакатона сделаем просто: за каждые 100 очков даем +1 уровень.

    // (В реальной игре очки сохраняются в базе и суммируются,
    // но пока у нас нет базы, мы просто покажем "уровень за эту игру")
    let earnedLevels = Math.floor(earned / 100);
    if (earnedLevels > 0) {
        currentLevel += earnedLevels;
        document.getElementById('level').textContent = currentLevel;

        // Если игрок получил 2 уровень, разблокируем "Бесконечный"
        if (currentLevel >= 2) {
            document.querySelectorAll('.level-card')[0].style.opacity = '1';
            document.querySelectorAll('.level-card')[0].style.cursor = 'pointer';
        }
        // Если 3 уровень, разблокируем "Сложный"
        if (currentLevel >= 3) {
            document.querySelectorAll('.level-card')[2].style.opacity = '1';
            document.querySelectorAll('.level-card')[2].style.cursor = 'pointer';
        }

        // Всплывающее окно о новом уровне (просто алерт)
        setTimeout(() => {
            alert(`🎉 Поздравляем! Вы достигли ${currentLevel} уровня!`);
        }, 500);
    }

    document.getElementById('game-over').style.display = 'block';
    document.querySelectorAll('.key').forEach(k => k.classList.remove('active'));
}

function restartGame() {
    // Возвращаемся в меню
    document.getElementById('start-screen').style.display = 'block';
    document.getElementById('game-screen').style.display = 'none';
    clearInterval(timerInterval);
    isGameActive = false;
}



function saveResult() {
    const name = document.getElementById('playerName').value;
    const points = document.getElementById('earned').textContent;
    
    if (!name) { alert("Пожалуйста, введи имя!"); return; }
    
    fetch('/save_result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, points: parseInt(points) })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'ok') alert(`Результат игрока ${name} сохранён!`);
        else alert('Ошибка сохранения');
    })
    .catch(error => alert('Не удалось связаться с сервером. Убедись, что app.py запущен.'));
}

