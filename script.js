// Инициализация Telegram Web App
let tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// URL вашего Python бэкенда (замените на реальный)
const BACKEND_URL = "https://falsusmortalis.github.io/shift.github.io/";

// Данные приложения
let appData = {
    employees: [],
    schedule: {},
    results: null
};

// Показ вкладок
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

// Обновление полей сотрудников
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

// Сохранение сотрудников
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
                .filter(d => d)
                .map(d => parseDate(d))
                .filter(d => d !== null);
            
            appData.employees.push({
                name: name,
                vacation_days: vacationDates.map(d => formatDate(d)),
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
            
            try {
                const date = parseDate(dateStr);
                if (date) {
                    const shifts = shiftsStr.split(',')
                        .map(s => parseInt(s.trim()))
                        .filter(s => s >= 1 && s <= 7);
                    
                    if (shifts.length > 0) {
                        appData.schedule[formatDate(date)] = shifts;
                        parsedDays++;
                        parsedShifts += shifts.length;
                    }
                }
            } catch (e) {
                console.error('Ошибка парсинга строки:', line);
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

// Генерация расписания через бэкенд
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
        const response = await fetch(BACKEND_URL + '/api/distribute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                employees: appData.employees,
                schedule: appData.schedule
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            appData.results = result.data;
            displayResults();
            showNotification('Расписание успешно сгенерировано!', 'success');
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        showNotification('Ошибка при распределении: ' + error.message, 'error');
    } finally {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('generateBtn').disabled = false;
    }
}

// Отображение результатов
function displayResults() {
    const container = document.getElementById('resultsContainer');
    const results = appData.results;
    
    if (!results) return;
    
    let html = `
        <div class="result-item">
            <strong>📊 Статистика распределения:</strong><br>
            Всего нарядов: ${results.statistics.total_assigned + results.statistics.total_unassigned}<br>
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
    
    // Назначенные наряды
    if (results.assigned_shifts.length > 0) {
        html += '<h3>✅ Назначенные наряды:</h3>';
        results.assigned_shifts.forEach(shift => {
            html += `
                <div class="result-item">
                    ${shift.date} - Наряд ${shift.type} → ${shift.employee_name}
                </div>
            `;
        });
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

// Вспомогательные функции
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

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
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
        const welcomeText = `Добро пожаловать, ${user.first_name || 'пользователь'}!`;
        console.log(welcomeText);
    }
});
