// Данные приложения
let appData = {
    employees: [],
    schedule: {},
    results: null
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
                    <small>0 - обычный, 1-5 - повышенный, 6-10 - высокий приоритет</small>
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
            
            console.log(`Добавлен сотрудник: ${name}, отпуск: ${vacationDays.length} дней, желаемые дни: ${preferredDays.length}, приоритет: ${priority}`);
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

// Генерация расписания
function generateSchedule() {
    console.log("Генерируем расписание...");
    
    if (appData.employees.length === 0) {
        alert('❌ Сначала добавьте сотрудников');
        showTab('employees');
        return;
    }
    
    if (Object.keys(appData.schedule).length === 0) {
        alert('❌ Сначала загрузите расписание');
        showTab('schedule');
        return;
    }
    
    // Показать загрузку
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('generateBtn').disabled = true;
    
    // Даем небольшую задержку для отображения loading
    setTimeout(() => {
        try {
            // Логика распределения
            const results = distributeShifts();
            appData.results = results;
            displayResults();
            
            alert('✅ Расписание успешно сгенерировано!');
            
        } catch (error) {
            console.error('Ошибка:', error);
            alert('❌ Ошибка при генерации расписания: ' + error.message);
        } finally {
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('generateBtn').disabled = false;
        }
    }, 500);
}

// Алгоритм распределения с учетом занятости на 2 дня
function distributeShifts() {
    const assigned = [];
    const unassigned = [];
    const employeeStats = {};
    const occupiedDays = {}; // Занятые дни для каждого сотрудника
    
    // Инициализация статистики и занятых дней
    appData.employees.forEach(emp => {
        employeeStats[emp.name] = { 
            shiftsCount: 0, 
            monthlySlots: 15 
        };
        occupiedDays[emp.name] = new Set();
    });
    
    // Создаем все наряды и сортируем по дате
    const allShifts = [];
    for (const [date, shiftTypes] of Object.entries(appData.schedule)) {
        for (const type of shiftTypes) {
            allShifts.push({ date, type });
        }
    }
    
    // Сортируем по дате
    allShifts.sort((a, b) => a.date.localeCompare(b.date));
    
    console.log(`Всего нарядов для распределения: ${allShifts.length}`);
    
    // Распределяем наряды
    for (const shift of allShifts) {
        const occupiedDates = getOccupiedDatesForShift(shift);
        let assignedEmployee = null;
        let bestScore = -1;
        
        // Ищем подходящего сотрудника с учетом приоритета и желаемых дней
        for (const employee of appData.employees) {
            const score = calculateAssignmentScore(employee, occupiedDates, occupiedDays[employee.name], employeeStats[employee.name], shift.type);
            
            if (score > bestScore) {
                assignedEmployee = employee;
                bestScore = score;
            }
        }
        
        if (assignedEmployee && bestScore > 0) {
            // Назначаем наряд
            assigned.push({
                date: shift.date,
                type: shift.type,
                employee: assignedEmployee.name
            });
            
            // Обновляем статистику
            employeeStats[assignedEmployee.name].shiftsCount++;
            if (shift.type !== 7) {
                employeeStats[assignedEmployee.name].monthlySlots--;
            }
            
            // Помечаем дни как занятые
            occupiedDates.forEach(date => {
                occupiedDays[assignedEmployee.name].add(date);
            });
            
            console.log(`Назначен наряд: ${shift.date} тип ${shift.type} → ${assignedEmployee.name} (оценка: ${bestScore})`);
        } else {
            unassigned.push({
                date: shift.date,
                type: shift.type
            });
            
            console.log(`Нераспределен наряд: ${shift.date} тип ${shift.type}`);
        }
    }
    
    return {
        assigned: assigned,
        unassigned: unassigned,
        employeeStats: employeeStats,
        total: {
            employees: appData.employees.length,
            assigned: assigned.length,
            unassigned: unassigned.length,
            total: assigned.length + unassigned.length
        }
    };
}

// Расчет оценки для назначения наряда
function calculateAssignmentScore(employee, occupiedDates, empOccupiedDays, stats, shiftType) {
    let score = 100;
    
    // Проверка отпуска - абсолютное запрещение
    for (const date of occupiedDates) {
        if (employee.vacationDays.includes(date)) {
            return 0;
        }
    }
    
    // Проверка лимита для суточных нарядов
    if (shiftType !== 7 && stats.monthlySlots <= 0) {
        return 0;
    }
    
    // Проверка занятости в нужные дни
    for (const date of occupiedDates) {
        if (empOccupiedDays.has(date)) {
            return 0;
        }
    }
    
    // Штраф за назначение на желаемые дни отдыха
    for (const date of occupiedDates) {
        if (employee.preferredDays.includes(date)) {
            score -= 30; // Существенный штраф, но не полный запрет
        }
    }
    
    // Бонус за приоритет сотрудника
    score += employee.priority * 2;
    
    // Бонус за меньшее количество назначенных нарядов
    score += (15 - stats.shiftsCount) * 1;
    
    return Math.max(0, score);
}

// Получение занятых дат для наряда
function getOccupiedDatesForShift(shift) {
    if (shift.type === 7) {
        return [shift.date]; // 8-часовой наряд - только один день
    } else {
        const nextDay = getNextDay(shift.date);
        return nextDay ? [shift.date, nextDay] : [shift.date]; // Суточные наряды - 2 дня
    }
}

// Отображение результатов
function displayResults() {
    showStats();
    buildTable();
    showUnassigned();
    changeView(); // Показываем выбранный вид
}

// Показ статистики
function showStats() {
    const container = document.getElementById('resultsContainer');
    const results = appData.results;
    
    let html = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${results.total.total}</div>
                <div class="stat-label">Всего нарядов</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${results.total.assigned}</div>
                <div class="stat-label">Распределено</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${results.total.unassigned}</div>
                <div class="stat-label">Нераспределено</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${results.total.employees}</div>
                <div class="stat-label">Сотрудников</div>
            </div>
        </div>
        
        <h3>📊 По сотрудникам:</h3>
    `;
    
    for (const [name, stats] of Object.entries(results.employeeStats)) {
        let employeeShifts = results.assigned.filter(s => s.employee === name).length;
        
        html += `
            <div class="result-item">
                <strong>${name}</strong><br>
                Нарядов: ${employeeShifts}<br>
                Осталось слотов: ${stats.monthlySlots}<br>
                Приоритет: ${appData.employees.find(e => e.name === name)?.priority || 0}
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// Построение таблицы
function buildTable() {
    const table = document.getElementById('calendarTable');
    const results = appData.results;
    
    // Собираем все даты
    const allDates = new Set();
    results.assigned.forEach(s => allDates.add(s.date));
    results.unassigned.forEach(s => allDates.add(s.date));
    
    // Добавляем дни отдыха после суточных нарядов
    results.assigned.forEach(shift => {
        if (shift.type !== 7) {
            const nextDay = getNextDay(shift.date);
            if (nextDay) allDates.add(nextDay);
        }
    });
    
    let dates = Array.from(allDates).sort();
    
    // Заголовок
    let html = '<tr><th class="employee-cell">Сотрудник</th>';
    dates.forEach(date => {
        html += `<th title="${date}">${date.split('.')[0]}.${date.split('.')[1]}</th>`;
    });
    html += '<th>Итого</th></tr>';
    
    // Данные сотрудников
    for (const employee of appData.employees) {
        let row = `<tr><td class="employee-cell">${employee.name}</td>`;
        let totalShifts = 0;
        
        for (const date of dates) {
            let content = '';
            let cellClass = '';
            let title = date;
            
            // Проверяем отпуск
            if (employee.vacationDays.includes(date)) {
                content = 'Х';
                cellClass = 'vacation-cell';
                title += ' - Отпуск';
            } 
            // Проверяем назначенный наряд в эту дату
            else {
                const shiftOnThisDate = results.assigned.find(s => s.date === date && s.employee === employee.name);
                if (shiftOnThisDate) {
                    content = shiftOnThisDate.type;
                    // Проверяем, является ли этот день желаемым для отдыха
                    if (employee.preferredDays.includes(date)) {
                        cellClass = 'preferred-rest-cell';
                        title += ' - Желаемый день отдыха (НАЗНАЧЕН НАРЯД)';
                    } else {
                        cellClass = 'shift-cell';
                        title += ` - Наряд тип ${shiftOnThisDate.type}`;
                    }
                    totalShifts++;
                } 
                // Проверяем день отдыха после суточного наряда
                else {
                    const prevDate = getPrevDay(date);
                    const prevDayShift = prevDate ? results.assigned.find(s => 
                        s.date === prevDate && 
                        s.employee === employee.name && 
                        s.type !== 7
                    ) : null;
                    
                    if (prevDayShift) {
                        content = '*';
                        cellClass = 'rest-cell';
                        title += ' - Отдых после суточного наряда';
                    }
                    // Проверяем, является ли день желаемым для отдыха (но без наряда)
                    else if (employee.preferredDays.includes(date)) {
                        content = '○';
                        cellClass = 'preferred-rest-cell';
                        title += ' - Желаемый день отдыха (свободен)';
                    }
                }
            }
            
            row += `<td class="${cellClass}" title="${title}">${content}</td>`;
        }
        
        row += `<td><strong>${totalShifts}</strong></td></tr>`;
        html += row;
    }
    
    // Нераспределенные наряды
    let unassignedToShow = results.unassigned;
    
    if (unassignedToShow.length > 0) {
        let row = '<tr><td class="employee-cell" style="background:#e74c3c;color:white;">Нераспределенные</td>';
        
        for (const date of dates) {
            const count = unassignedToShow.filter(s => s.date === date).length;
            if (count > 0) {
                const types = unassignedToShow.filter(s => s.date === date).map(s => s.type).join(',');
                row += `<td class="unassigned-cell" title="${date} - Типы: ${types}">${count}</td>`;
            } else {
                row += '<td></td>';
            }
        }
        
        row += `<td><strong>${unassignedToShow.length}</strong></td></tr>`;
        html += row;
    }
    
    table.innerHTML = html;
}

// Показ нераспределенных нарядов
function showUnassigned() {
    const container = document.getElementById('unassignedContainer');
    let unassigned = appData.results.unassigned;
    
    if (unassigned.length === 0) {
        container.innerHTML = '<div class="result-item">🎉 Все наряды распределены!</div>';
        return;
    }
    
    // Группируем по датам
    const byDate = {};
    unassigned.forEach(shift => {
        if (!byDate[shift.date]) byDate[shift.date] = [];
        byDate[shift.date].push(shift.type);
    });
    
    let html = '<h3>⚠️ Нераспределенные наряды</h3>';
    
    // Сортируем даты
    const sortedDates = Object.keys(byDate).sort();
    
    for (const date of sortedDates) {
        const types = byDate[date];
        html += `
            <div class="error-item">
                <strong>${date}</strong><br>
                Типы нарядов: ${types.join(', ')}<br>
                Количество: ${types.length}
            </div>
        `;
    }
    
    html += `<div class="error-item" style="background:#d63031;color:white;">
        <strong>Всего нераспределено: ${unassigned.length} нарядов</strong>
    </div>`;
    
    container.innerHTML = html;
}

// Смена вида отображения
function changeView() {
    const viewType = document.getElementById('viewType').value;
    
    // Скрыть все виды
    document.getElementById('statsView').classList.add('hidden');
    document.getElementById('tableView').classList.add('hidden');
    document.getElementById('unassignedView').classList.add('hidden');
    
    // Показать выбранный вид
    document.getElementById(viewType + 'View').classList.remove('hidden');
}

// Функции для вкладки поддержки
function copyPhoneNumber() {
    const phoneNumber = '+7 989 275 82 74';
    navigator.clipboard.writeText(phoneNumber).then(function() {
        alert('✅ Номер телефона скопирован: ' + phoneNumber);
    }, function() {
        prompt('Скопируйте номер телефона:', phoneNumber);
    });
}