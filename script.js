// Глобальные переменные
let scheduler = new ShiftScheduler();
let appData = {
    employees: [],
    schedule: {}
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    console.log("Приложение загружено!");
    
    // Инициализация Telegram Web App
    if (typeof window.Telegram !== 'undefined') {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        console.log("Telegram Web App инициализирован");
    }
    
    // Инициализация интерфейса
    initTabs();
    initEmployeeFields();
    setupEventListeners();
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
    
    // Показать выбранную вкладку
    document.getElementById(tabName + '-tab').classList.add('active');
    
    // Обновить активную кнопку
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
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
                    <label>Отпуск (через запятую ДД.ММ.ГГГГ):</label>
                    <input type="text" id="empVacation${i}" placeholder="01.10.2025, 02.10.2025">
                </div>
                <div class="input-group">
                    <label>Приоритет (0-10):</label>
                    <input type="number" id="empPriority${i}" min="0" max="10" value="0">
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Сохранение сотрудников
    document.getElementById('saveEmployeesBtn').addEventListener('click', saveEmployees);
    
    // Обработка расписания
    document.getElementById('parseScheduleBtn').addEventListener('click', parseSchedule);
    
    // Генерация расписания
    document.getElementById('generateBtn').addEventListener('click', generateSchedule);
}

// Сохранение сотрудников
// Сохранение сотрудников
function saveEmployees() {
    console.log("Сохраняем сотрудников...");
    
    const count = parseInt(document.getElementById('employeeCount').value);
    appData.employees = [];
    
    for (let i = 0; i < count; i++) {
        const name = document.getElementById('empName' + i).value.trim();
        if (name) {
            const vacationStart = document.getElementById('empVacationStart' + i).value.trim();
            const vacationEnd = document.getElementById('empVacationEnd' + i).value.trim();
            const priority = parseInt(document.getElementById('empPriority' + i).value) || 0;
            
            let vacationDates = [];
            
            // Обрабатываем период отпуска
            if (vacationStart && vacationEnd) {
                vacationDates = generateDateRange(vacationStart, vacationEnd);
            }
            
            appData.employees.push({
                name: name,
                vacationDays: vacationDates,
                priority: priority
            });
        }
    }
    
    if (appData.employees.length > 0) {
        showNotification(`Добавлено ${appData.employees.length} сотрудников`, 'success');
        showTab('schedule');
    } else {
        showNotification('Добавьте хотя бы одного сотрудника', 'error');
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
        return new Date(year, month, day);
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
    }
    
    if (appData.employees.length > 0) {
        showNotification(`Добавлено ${appData.employees.length} сотрудников`, 'success');
        showTab('schedule');
    } else {
        showNotification('Добавьте хотя бы одного сотрудника', 'error');
    }
}

// Парсинг расписания
function parseSchedule() {
    console.log("Парсим расписание...");
    
    const scheduleText = document.getElementById('manualSchedule').value;
    if (!scheduleText.trim()) {
        showNotification('Введите расписание', 'error');
        return;
    }
    
    appData.schedule = {};
    const lines = scheduleText.split('\n');
    let parsedDays = 0;
    let parsedShifts = 0;
    
    // Пример данных для теста, если поле пустое
    if (scheduleText.trim() === '') {
        appData.schedule = {
            '01.10.2025': [1, 2, 3],
            '02.10.2025': [1, 2],
            '03.10.2025': [1, 2, 3, 4]
        };
        parsedDays = 3;
        parsedShifts = 8;
    } else {
        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('дата')) continue;
            
            const parts = line.split(';');
            if (parts.length >= 2) {
                const dateStr = parts[0].trim();
                const shiftsStr = parts[1].trim();
                
                // Простая валидация даты
                if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
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
    }
    
    if (parsedDays > 0) {
        showNotification(`Расписание загружено: ${parsedDays} дней, ${parsedShifts} нарядов`, 'success');
        showTab('results');
    } else {
        showNotification('Не удалось распарсить расписание. Используйте формат: дата;наряды', 'error');
    }
}

// Генерация расписания
function generateSchedule() {
    console.log("Генерируем расписание...");
    
    if (appData.employees.length === 0) {
        showNotification('Сначала добавьте сотрудников', 'error');
        return;
    }
    
    if (Object.keys(appData.schedule).length === 0) {
        showNotification('Сначала загрузите расписание', 'error');
        return;
    }
    
    // Показать загрузку
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('generateBtn').disabled = true;
    
    // Даем небольшую задержку для отображения loading
    setTimeout(() => {
        try {
            // Создаем новый планировщик
            scheduler = new ShiftScheduler();
            
            // Добавляем сотрудников
            appData.employees.forEach(empData => {
                scheduler.addEmployee(
                    empData.name,
                    empData.vacationDays,
                    empData.priority
                );
            });
            
            // Генерируем расписание
            scheduler.generateSchedule(appData.schedule);
            
            // Форматируем результаты
            appData.results = formatResults(scheduler);
            
            // Показываем результаты
            displayResults();
            
            // Сбрасываем выбор вида на "список"
            document.getElementById('viewType').value = 'list';
            document.getElementById('tableView').classList.add('hidden');
            document.getElementById('resultsContainer').classList.remove('hidden');
            
            showNotification('Расписание успешно сгенерировано!', 'success');
            
        } catch (error) {
            console.error('Ошибка:', error);
            showNotification('Ошибка: ' + error.message, 'error');
        } finally {
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('generateBtn').disabled = false;
        }
    }, 500);
}

// Отображение результатов
function displayResults() {
    const container = document.getElementById('resultsContainer');
    const stats = scheduler.getStatistics();
    
    let html = `
        <div class="result-item">
            <strong>📊 Статистика распределения:</strong><br>
            Всего нарядов: ${stats.totalRequested}<br>
            Распределено: ${stats.totalAssigned}<br>
            Нераспределено: ${stats.totalUnassigned}<br>
            Сотрудников: ${stats.totalEmployees}
        </div>
    `;
    
    // Распределение по сотрудникам
    html += '<h3>📋 Распределение по сотрудникам:</h3>';
    scheduler.employees.forEach(employee => {
        const employeeStats = scheduler.employeeStats.get(employee.id);
        html += `
            <div class="result-item">
                <strong>${employee.name}</strong><br>
                Нарядов: ${employeeStats.shiftsCount}<br>
                Осталось слотов: ${employeeStats.monthlySlots}
            </div>
        `;
    });
    
    // Назначенные наряды
    if (scheduler.assignedShifts.length > 0) {
        html += '<h3>✅ Назначенные наряды:</h3>';
        scheduler.assignedShifts.slice(0, 10).forEach(shift => {
            html += `
                <div class="result-item">
                    ${shift.date} - Наряд ${shift.type} → ${shift.employeeName}
                </div>
            `;
        });
        if (scheduler.assignedShifts.length > 10) {
            html += `<div class="result-item">... и еще ${scheduler.assignedShifts.length - 10} нарядов</div>`;
        }
    }
    
    // Нераспределенные наряды
    if (scheduler.unassignedShifts.length > 0) {
        html += '<h3>⚠️ Нераспределенные наряды:</h3>';
        scheduler.unassignedShifts.forEach(shift => {
            html += `
                <div class="error-item">
                    ${shift.date} - Наряд ${shift.type}
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
}
// Переключение между видами
function changeViewType() {
    const viewType = document.getElementById('viewType').value;
    const listView = document.getElementById('resultsContainer');
    const tableView = document.getElementById('tableView');
    
    if (viewType === 'table') {
        listView.classList.add('hidden');
        tableView.classList.remove('hidden');
        buildCalendarTable();
    } else {
        listView.classList.remove('hidden');
        tableView.classList.add('hidden');
    }
}

// Построение календарной таблицы
function buildCalendarTable() {
    if (!appData.results) return;
    
    const table = document.getElementById('calendarTable');
    table.innerHTML = '';
    
    // Собираем все уникальные даты
    const allDates = new Set();
    
    // Добавляем даты из назначенных нарядов
    appData.results.assigned_shifts.forEach(shift => {
        allDates.add(shift.date);
    });
    
    // Добавляем даты из нераспределенных нарядов
    appData.results.unassigned_shifts.forEach(shift => {
        allDates.add(shift.date);
    });
    
    // Преобразуем в массив и сортируем
    const sortedDates = Array.from(allDates).sort((a, b) => {
        return new Date(a.split('.').reverse().join('-')) - new Date(b.split('.').reverse().join('-'));
    });
    
    // Создаем заголовок таблицы
    let headerRow = '<tr><th class="employee-name">Сотрудник</th>';
    sortedDates.forEach(date => {
        const day = date.split('.')[0];
        headerRow += `<th title="${date}">${day}</th>`;
    });
    headerRow += '<th>Итого</th></tr>';
    table.innerHTML = headerRow;
    
    // Добавляем строки для каждого сотрудника
    Object.keys(appData.results.employee_stats).forEach(employeeName => {
        let row = `<tr><td class="employee-name">${employeeName}</td>`;
        let totalShifts = 0;
        
        sortedDates.forEach(date => {
            const cell = getCellContent(employeeName, date);
            if (cell.type === 'shift') totalShifts++;
            row += `<td class="${cell.class}" title="${date}: ${cell.title}">${cell.content}</td>`;
        });
        
        // Добавляем итого
        row += `<td style="background: #e8f5e8; font-weight: bold;">${totalShifts}</td></tr>`;
        table.innerHTML += row;
    });
    
    // Добавляем строку с нераспределенными нарядами
    if (appData.results.unassigned_shifts.length > 0) {
        let unassignedRow = '<tr><td class="employee-name" style="background: #ffebee;">Нераспределенные</td>';
        let unassignedCount = 0;
        
        sortedDates.forEach(date => {
            const shiftsOnDate = appData.results.unassigned_shifts.filter(s => s.date === date);
            if (shiftsOnDate.length > 0) {
                unassignedRow += `<td class="error-day" title="${date}: ${shiftsOnDate.map(s => `Наряд ${s.type}`).join(', ')}">${shiftsOnDate.length}</td>`;
                unassignedCount += shiftsOnDate.length;
            } else {
                unassignedRow += '<td></td>';
            }
        });
        
        unassignedRow += `<td style="background: #ffebee; font-weight: bold;">${unassignedCount}</td></tr>`;
        table.innerHTML += unassignedRow;
    }
}

// Получение содержимого ячейки для конкретного сотрудника и даты
function getCellContent(employeeName, date) {
    const employee = appData.employees.find(e => e.name === employeeName);
    if (!employee) return { content: '', class: 'empty-day', title: 'Нет данных' };
    
    // Проверяем отпуск
    if (employee.vacationDays && employee.vacationDays.includes(date)) {
        return { content: 'Х', class: 'vacation-day', title: 'Отпуск' };
    }
    
    // Ищем назначенные наряды
    const assignedShift = appData.results.assigned_shifts.find(s => 
        s.employee_name === employeeName && s.date === date
    );
    
    if (assignedShift) {
        return { 
            content: assignedShift.type, 
            class: 'shift-day', 
            title: `Наряд ${assignedShift.type}` 
        };
    }
    
    // Проверяем день отдыха после суточного наряда
    const prevDate = getPreviousDay(date);
    const prevShift = appData.results.assigned_shifts.find(s => 
        s.employee_name === employeeName && s.date === prevDate
    );
    
    if (prevShift && prevShift.type !== 7) { // Если предыдущий наряд был суточным (не тип 7)
        return { content: '*', class: 'rest-day', title: 'Отдых после наряда' };
    }
    
    return { content: '', class: 'empty-day', title: 'Свободен' };
}

// Вспомогательная функция для получения предыдущей даты
function getPreviousDay(dateStr) {
    const [day, month, year] = dateStr.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    
    const prevDay = String(date.getDate()).padStart(2, '0');
    const prevMonth = String(date.getMonth() + 1).padStart(2, '0');
    const prevYear = date.getFullYear();
    
    return `${prevDay}.${prevMonth}.${prevYear}`;
}

// Обновляем функцию displayResults для поддержки таблицы
function displayResults() {
    const container = document.getElementById('resultsContainer');
    const results = appData.results;
    
    if (!results) return;
    
    let html = `
        <div class="result-item">
            <strong>📊 Статистика распределения:</strong><br>
            Всего нарядов: ${results.statistics.total_requested}<br>
            Распределено: ${results.statistics.total_assigned}<br>
            Нераспределено: ${results.statistics.total_unassigned}<br>
            Сотрудников: ${results.statistics.total_employees}
        </div>
    `;
    
    // Распределение по сотрудникам
    html += '<h3>📋 Распределение по сотрудникам:</h3>';
    for (const [empName, stats] of Object.entries(results.employee_stats)) {
        html += `
            <div class="result-item">
                <strong>${empName}</strong><br>
                Нарядов: ${stats.shifts_count}<br>
                Осталось слотов: ${stats.remaining_slots}
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    // Строим таблицу (изначально скрыта)
    buildCalendarTable();
}
// Форматируем результаты для отображения
function formatResults(scheduler) {
    const stats = scheduler.getStatistics();
    
    // Назначенные наряды
    const assignedShifts = scheduler.assignedShifts.map(shift => {
        const employee = scheduler.employees.find(e => e.id === shift.employeeId);
        return {
            date: shift.date,
            type: shift.type,
            employee_name: employee ? employee.name : 'Неизвестно'
        };
    });
    
    // Нераспределенные наряды
    const unassignedShifts = scheduler.unassignedShifts.map(shift => ({
        date: shift.date,
        type: shift.type,
        reason: "Не удалось распределить"
    }));
    
    // Статистика по сотрудникам
    const employeeStats = {};
    scheduler.employees.forEach(emp => {
        const stats = scheduler.employeeStats.get(emp.id);
        employeeStats[emp.name] = {
            shifts_count: stats.shiftsCount,
            remaining_slots: stats.monthlySlots
        };
    });
    
    return {
        assigned_shifts: assignedShifts,
        unassigned_shifts: unassignedShifts,
        employee_stats: employeeStats,
        statistics: {
            total_employees: stats.totalEmployees,
            total_assigned: stats.totalAssigned,
            total_unassigned: stats.totalUnassigned,
            total_requested: stats.totalRequested
        }
    };
}

// Функция для отображения нераспределенных нарядов в виде таблицы
function displayUnassignedShiftsTable(unassignedShifts) {
    if (!unassignedShifts || unassignedShifts.length === 0) {
        return '<p>Все наряды распределены 🎉</p>';
    }
    
    // Группируем по датам
    const shiftsByDate = {};
    unassignedShifts.forEach(shift => {
        if (!shiftsByDate[shift.date]) {
            shiftsByDate[shift.date] = [];
        }
        shiftsByDate[shift.date].push(shift.type);
    });
    
    let html = `
        <div style="margin: 15px 0;">
            <h3>⚠️ Нераспределенные наряды</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Дата</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Типы нарядов</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Количество</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    const sortedDates = Object.keys(shiftsByDate).sort((a, b) => {
        return new Date(a.split('.').reverse().join('-')) - new Date(b.split('.').reverse().join('-'));
    });
    
    sortedDates.forEach(date => {
        const shifts = shiftsByDate[date];
        html += `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;"><strong>${date}</strong></td>
                <td style="border: 1px solid #ddd; padding: 8px;">${shifts.join(', ')}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${shifts.length}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
                <tfoot>
                    <tr style="background: #fff3cd;">
                        <td colspan="2" style="border: 1px solid #ddd; padding: 8px; text-align: right;"><strong>Всего нераспределено:</strong></td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;"><strong>${unassignedShifts.length}</strong></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
    
    return html;
}

// Обновляем функцию displayResults
function displayResults() {
    const container = document.getElementById('resultsContainer');
    const results = appData.results;
    
    if (!results) return;
    
    let html = `
        <div class="result-item">
            <strong>📊 Статистика распределения:</strong><br>
            Всего нарядов: ${results.statistics.total_requested}<br>
            Распределено: ${results.statistics.total_assigned}<br>
            Нераспределено: ${results.statistics.total_unassigned}<br>
            Сотрудников: ${results.statistics.total_employees}
        </div>
    `;
    
    // Распределение по сотрудникам
    html += '<h3>📋 Распределение по сотрудникам:</h3>';
    for (const [empName, stats] of Object.entries(results.employee_stats)) {
        html += `
            <div class="result-item">
                <strong>${empName}</strong><br>
                Нарядов: ${stats.shifts_count}<br>
                Осталось слотов: ${stats.remaining_slots}
            </div>
        `;
    }
    
    // Добавляем таблицу нераспределенных нарядов
    html += displayUnassignedShiftsTable(results.unassigned_shifts);
    
    container.innerHTML = html;
    
    // Строим календарную таблицу (изначально скрыта)
    buildCalendarTable();
}
// Показать уведомление
function showNotification(message, type) {
    console.log(type + ":", message);
    
    // Простое уведомление через alert
    alert((type === 'success' ? '✅ ' : '❌ ') + message);
    
    // Если в Telegram, используем его popup
    if (typeof window.Telegram !== 'undefined') {
        window.Telegram.WebApp.showPopup({
            title: type === 'success' ? 'Успех' : 'Ошибка',
            message: message
        });
    }
}
