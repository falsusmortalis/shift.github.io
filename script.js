// Данные приложения
let appData = {
    employees: [],
    schedule: {},
    results: null
};

// Система оплаты и доступа
let userSubscription = {
    type: 'demo', // 'demo', 'single', 'monthly'
    generationsLeft: 999,
    expiryDate: null,
    isActive: true
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    console.log("Приложение загружено!");
    
    // Инициализация Telegram Web App
    if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        console.log("Telegram Web App инициализирован");
    }
    
    // Инициализация интерфейса
    initTabs();
    initEmployeeFields();
    setupEventListeners();
    initSubscriptionSystem();
    
    console.log("Приложение готово к работе");
});

// Инициализация вкладок
function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            showTab(tabName);
        });
    });
}

// Показать вкладку
function showTab(tabName) {
    console.log("Переключаем на вкладку:", tabName);
    
    // Скрыть все вкладки
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Убрать активный класс со всех кнопок
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показать выбранную вкладку
    document.getElementById(tabName + '-tab').classList.add('active');
    
    // Активировать кнопку
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

// Инициализация полей сотрудников
function initEmployeeFields() {
    updateEmployeeFields();
    
    // Обновлять поля при изменении количества
    document.getElementById('employeeCount').addEventListener('change', updateEmployeeFields);
}

// Обновление полей сотрудников
function updateEmployeeFields() {
    const count = parseInt(document.getElementById('employeeCount').value);
    const container = document.getElementById('employeeFields');
    
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="employee-item">
                <h3>Сотрудник ${i + 1}</h3>
                <div class="input-group">
                    <label>Фамилия:</label>
                    <input type="text" id="empName${i}" placeholder="Иванов" value="Сотрудник ${i + 1}">
                </div>
                <div class="input-group">
                    <label>Отпуск (период):</label>
                    <div class="date-range">
                        <input type="text" id="vacStart${i}" placeholder="01.10.2025">
                        <span>по</span>
                        <input type="text" id="vacEnd${i}" placeholder="05.10.2025">
                    </div>
                </div>
                <div class="input-group">
                    <label>Желаемые дни отдыха (дни рождения, праздники):</label>
                    <div id="preferredDaysContainer${i}" class="preferred-days-input">
                        <input type="text" id="preferredDay${i}_0" placeholder="01.10.2025">
                    </div>
                    <button type="button" class="add-preferred-day" onclick="addPreferredDay(${i})">+ Добавить день</button>
                </div>
                <div class="input-group">
                    <label>Приоритет (0-10):</label>
                    <input type="number" id="priority${i}" min="0" max="10" value="0">
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// Добавление поля для желаемого дня отдыха
function addPreferredDay(employeeIndex) {
    const container = document.getElementById('preferredDaysContainer' + employeeIndex);
    const inputCount = container.querySelectorAll('input').length;
    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.id = 'preferredDay' + employeeIndex + '_' + inputCount;
    newInput.placeholder = '01.10.2025';
    container.appendChild(newInput);
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Сохранение сотрудников
    document.getElementById('saveEmployeesBtn').addEventListener('click', saveEmployees);
    
    // Обработка расписания
    document.getElementById('parseScheduleBtn').addEventListener('click', parseSchedule);
    
    // Генерация расписания
    document.getElementById('generateBtn').addEventListener('click', generateSchedule);
    
    // Переключение вида результатов
    document.getElementById('viewType').addEventListener('change', changeView);
}

// Сохранение сотрудников
function saveEmployees() {
    console.log("Сохраняем сотрудников...");
    
    const count = parseInt(document.getElementById('employeeCount').value);
    appData.employees = [];
    
    for (let i = 0; i < count; i++) {
        const name = document.getElementById('empName' + i).value.trim();
        if (name) {
            const vacationStart = document.getElementById('vacStart' + i).value.trim();
            const vacationEnd = document.getElementById('vacEnd' + i).value.trim();
            const priority = parseInt(document.getElementById('priority' + i).value) || 0;
            
            // Собираем желаемые дни отдыха
            const preferredDays = [];
            const preferredInputs = document.querySelectorAll('#preferredDaysContainer' + i + ' input');
            preferredInputs.forEach(input => {
                if (input.value.trim()) {
                    preferredDays.push(input.value.trim());
                }
            });
            
            let vacationDays = [];
            
            // Обрабатываем период отпуска
            if (vacationStart && vacationEnd) {
                vacationDays = generateDateRange(vacationStart, vacationEnd);
            }
            
            appData.employees.push({
                name: name,
                vacationDays: vacationDays,
                preferredDays: preferredDays,
                priority: priority
            });
            
            console.log(`Добавлен сотрудник: ${name}, отпуск: ${vacationDays.length} дней, желаемые дни: ${preferredDays.length}`);
        }
    }
    
    if (appData.employees.length > 0) {
        alert('✅ Сохранено ' + appData.employees.length + ' сотрудников');
        showTab('schedule');
    } else {
        alert('❌ Добавьте хотя бы одного сотрудника');
    }
}

// Генерация диапазона дат
function generateDateRange(startStr, endStr) {
    const startDate = parseDate(startStr);
    const endDate = parseDate(endStr);
    
    if (!startDate || !endDate) {
        console.error("Неверный формат даты отпуска");
        return [];
    }
    
    const dates = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        dates.push(formatDate(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`Сгенерирован отпуск с ${formatDate(startDate)} по ${formatDate(endDate)}: ${dates.length} дней`);
    return dates;
}

// Парсинг даты из строки
function parseDate(dateStr) {
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        const date = new Date(year, month, day);
        // Проверяем валидность даты
        if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
            return date;
        }
    }
    return null;
}

// Форматирование даты в строку
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// Получение следующего дня
function getNextDay(dateStr) {
    const date = parseDate(dateStr);
    if (!date) return null;
    date.setDate(date.getDate() + 1);
    return formatDate(date);
}

// Получение предыдущего дня
function getPrevDay(dateStr) {
    const date = parseDate(dateStr);
    if (!date) return null;
    date.setDate(date.getDate() - 1);
    return formatDate(date);
}

// Парсинг расписания
function parseSchedule() {
    console.log("Парсим расписание...");
    
    const scheduleText = document.getElementById('manualSchedule').value;
    if (!scheduleText.trim()) {
        alert('❌ Введите расписание');
        return;
    }
    
    appData.schedule = {};
    const lines = scheduleText.split('\n');
    let parsedDays = 0;
    let parsedShifts = 0;
    
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('дата')) continue;
        
        const parts = line.split(';');
        if (parts.length >= 2) {
            const dateStr = parts[0].trim();
            const shiftsStr = parts[1].trim();
            
            // Валидация даты
            if (parseDate(dateStr)) {
                const shifts = shiftsStr.split(',')
                    .map(s => parseInt(s.trim()))
                    .filter(s => s >= 1 && s <= 7);
                
                if (shifts.length > 0) {
                    appData.schedule[dateStr] = shifts;
                    parsedDays++;
                    parsedShifts += shifts.length;
                }
            }
        }
    }
    
    if (parsedDays > 0) {
        alert(`✅ Загружено: ${parsedDays} дней, ${parsedShifts} нарядов`);
        showTab('results');
    } else {
        alert('❌ Не удалось распарсить расписание. Используйте формат: дата;наряды\nПример: 01.10.2025;1,2,3');
    }
}

// Проверка доступа при генерации расписания
function check