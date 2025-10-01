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
function saveEmployees() {
    console.log("Сохраняем сотрудников...");
    
    const count = parseInt(document.getElementById('employeeCount').value);
    appData.employees = [];
    
    for (let i = 0; i < count; i++) {
        const name = document.getElementById('empName' + i).value.trim();
        if (name) {
            const vacationText = document.getElementById('empVacation' + i).value || '';
            const priority = parseInt(document.getElementById('empPriority' + i).value) || 0;
            
            const vacationDates = vacationText.split(',')
                .map(d => d.trim())
                .filter(d => d);
            
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
            
            // Показываем результаты
            displayResults();
            
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
