// Инициализация Telegram Web App
let tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Создаем глобальный планировщик
let scheduler = new ShiftScheduler();

// Данные приложения
let appData = {
    employees: [],
    schedule: {},
    results: null
};

// [Остальной код остается таким же как в предыдущей версии, но обновляем generateSchedule]

// Генерация расписания - теперь полностью на клиенте
async function generateSchedule() {
    if (appData.employees.length === 0) {
        showNotification('Сначала добавьте сотрудников', 'error');
        return;
    }
    
    if (Object.keys(appData.schedule).length === 0) {
        showNotification('Сначала загрузите расписание', 'error');
        return;
    }
    
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('generateBtn').disabled = true;
    
    try {
        // Сбрасываем планировщик
        scheduler = new ShiftScheduler();
        
        // Добавляем сотрудников в планировщик
        appData.employees.forEach(empData => {
            scheduler.addEmployee(
                empData.name,
                empData.vacation_days,
                [], // preferred exclusion days
                empData.priority
            );
        });
        
        // Генерируем расписание
        scheduler.generateSchedule(appData.schedule);
        
        // Форматируем результаты
        appData.results = formatResults(scheduler);
        displayResults();
        
        showNotification('Расписание успешно сгенерировано!', 'success');
        
    } catch (error) {
        showNotification('Ошибка при распределении: ' + error.message, 'error');
        console.error(error);
    } finally {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('generateBtn').disabled = false;
    }
}

// Форматируем результаты для отображения
function formatResults(scheduler) {
    const stats = scheduler.getStatistics();
    
    // Назначенные наряды
    const assignedShifts = scheduler.assignedShifts.map(shift => {
        const employee = scheduler.employees.find(e => e.id === shift.employeeId);
        return {
            date: scheduler.formatDate(shift.date),
            type: shift.type,
            employee_name: employee ? employee.name : 'Неизвестно'
        };
    });
    
    // Нераспределенные наряды
    const unassignedShifts = scheduler.unassignedShifts.map(shift => ({
        date: scheduler.formatDate(shift.date),
        type: shift.type,
        reason: scheduler.analyzeUnassignedReason(shift)
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
            total_employees: stats.total_employees,
            total_assigned: stats.total_assigned,
            total_unassigned: stats.total_unassigned,
            total_requested: stats.total_requested
        }
    };
}

// [Остальные функции остаются без изменений]
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.classList.add('active');
}

function updateEmployeeFields() {
    const count = parseInt(document.getElementById('employeeCount').value);
    const container = document.getElementById('employeeFields');
    container.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
        const employeeHtml = `
            <div class="employee-item">
                <h3>Сотрудник ${i + 1}</h3>
                <div class="input-group">
                    <label>Фамилия:</label>
                    <input type="text" id="empName${i}" placeholder="Иванов">
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
        container.innerHTML += employeeHtml;
    }
}

function saveEmployees() {
    const count = parseInt(document.getElementById('employeeCount').value);
    appData.employees = [];
    
    for (let i = 0; i < count; i++) {
        const name = document.getElementById('empName' + i)?.value.trim();
        if (name) {
            const vacationText = document.getElementById('empVacation' + i)?.value || '';
            const priority = parseInt(document.getElementById('empPriority' + i)?.value) || 0;
            
            const vacationDates = vacationText.split(',')
                .map(d => d.trim())
                .filter(d => d);
            
            appData.employees.push({
                name: name,
                vacation_days: vacationDates,
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

function parseSchedule() {
    const scheduleText = document.getElementById('manualSchedule').value;
    if (!scheduleText.trim()) {
        showNotification('Введите расписание', 'error');
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
    
    if (parsedDays > 0) {
        showNotification(`Расписание загружено: ${parsedDays} дней, ${parsedShifts} нарядов`, 'success');
        showTab('results');
    } else {
        showNotification('Не удалось распарсить расписание', 'error');
    }
}

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
    
    // Назначенные наряды (первые 10)
    if (results.assigned_shifts.length > 0) {
        html += '<h3>✅ Назначенные наряды (первые 10):</h3>';
        results.assigned_shifts.slice(0, 10).forEach(shift => {
            html += `
                <div class="result-item">
                    ${shift.date} - Наряд ${shift.type} → ${shift.employee_name}
                </div>
            `;
        });
        if (results.assigned_shifts.length > 10) {
            html += `<div class="result-item">... и еще ${results.assigned_shifts.length - 10} нарядов</div>`;
        }
    }
    
    // Нераспределенные наряды
    if (results.unassigned_shifts.length > 0) {
        html += '<h3>⚠️ Нераспределенные наряды:</h3>';
        results.unassigned_shifts.forEach(shift => {
            html += `
                <div class="error-item">
                    ${shift.date} - Наряд ${shift.type}<br>
                    <small>Причина: ${shift.reason}</small>
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
}

function showNotification(message, type) {
    tg.showPopup({
        title: type === 'success' ? 'Успех' : 'Ошибка',
        message: message,
        buttons: [{ type: 'ok' }]
    });
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    updateEmployeeFields();
    
    // Показываем информацию о пользователе Telegram
    const user = tg.initDataUnsafe.user;
    if (user) {
        console.log(`Добро пожаловать, ${user.first_name || 'пользователь'}!`);
    }
});
