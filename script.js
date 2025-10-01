// Система оплаты и доступа
let userSubscription = {
    type: 'demo', // 'demo', 'single', 'monthly'
    generationsLeft: 0,
    expiryDate: null,
    isActive: false
};

// Инициализация системы доступа
function initSubscriptionSystem() {
    // Загружаем данные из localStorage
    const saved = localStorage.getItem('shiftScheduler_subscription');
    if (saved) {
        userSubscription = JSON.parse(saved);
    } else {
        // Активруем демо по умолчанию
        activateDemo();
    }
    updateStatusDisplay();
}

// Активация демо-режима
function activateDemo() {
    userSubscription = {
        type: 'demo',
        generationsLeft: 999, // Неограниченно для демо
        expiryDate: null,
        isActive: true
    };
    saveSubscription();
    updateStatusDisplay();
    alert('✅ Демо-режим активирован! Доступны первые 7 дней месяца.');
}

// Показ формы оплаты
function showPaymentForm(type) {
    const amount = type === 'monthly' ? '300' : '100';
    document.getElementById('paymentAmount').textContent = amount;
    document.getElementById('paymentForm').classList.remove('hidden');
    
    // Сохраняем выбранный тип для активации
    document.getElementById('paymentForm').dataset.paymentType = type;
}

// Активация премиум доступа
function activatePremium() {
    const code = document.getElementById('paymentCode').value.trim();
    const type = document.getElementById('paymentForm').dataset.paymentType;
    
    if (!code) {
        alert('❌ Введите код подтверждения');
        return;
    }
    
    // Здесь должна быть проверка кода через бэкенд
    // Для демо - простейшая проверка
    if (code.length >= 4) {
        userSubscription = {
            type: type,
            generationsLeft: type === 'monthly' ? 7 : 1,
            expiryDate: type === 'monthly' ? getDateInFuture(30) : null,
            isActive: true
        };
        
        saveSubscription();
        updateStatusDisplay();
        document.getElementById('paymentForm').classList.add('hidden');
        document.getElementById('paymentCode').value = '';
        
        alert('✅ Премиум доступ активирован!');
    } else {
        alert('❌ Неверный код подтверждения');
    }
}

// Получение даты в будущем
function getDateInFuture(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
}

// Сохранение подписки
function saveSubscription() {
    localStorage.setItem('shiftScheduler_subscription', JSON.stringify(userSubscription));
}

// Обновление отображения статуса
function updateStatusDisplay() {
    const statusInfo = document.getElementById('statusInfo');
    
    if (!userSubscription.isActive) {
        statusInfo.innerHTML = `
            <div class="status-inactive">
                <h4>❌ Нет активной подписки</h4>
                <p>Активируйте демо-режим или купите премиум доступ</p>
            </div>
        `;
        return;
    }
    
    if (userSubscription.type === 'demo') {
        statusInfo.innerHTML = `
            <div class="status-demo">
                <h4>🎯 Демо-режим</h4>
                <p>Доступны только первые 7 дней каждого месяца</p>
                <p><strong>Генераций осталось:</strong> Неограниченно</p>
            </div>
        `;
    } else {
        const typeName = userSubscription.type === 'monthly' ? 'Месячная подписка' : 'Разовый доступ';
        const expiryText = userSubscription.expiryDate ? 
            `Действует до: ${new Date(userSubscription.expiryDate).toLocaleDateString('ru-RU')}` : 
            'Действует 1 генерацию';
        
        statusInfo.innerHTML = `
            <div class="status-active">
                <h4>💎 ${typeName}</h4>
                <p><strong>Генераций осталось:</strong> ${userSubscription.generationsLeft}</p>
                <p>${expiryText}</p>
            </div>
        `;
    }
}

// Проверка доступа при генерации расписания
function checkAccess() {
    if (!userSubscription.isActive) {
        alert('❌ Нет активной подписки. Активируйте демо или купите доступ.');
        return false;
    }
    
    // Проверка лимита генераций для платных подписок
    if (userSubscription.type !== 'demo' && userSubscription.generationsLeft <= 0) {
        alert('❌ Лимит генераций исчерпан. Купите новую подписку.');
        showTab('payment');
        return false;
    }
    
    // Проверка демо-ограничения (только первые 7 дней месяца)
    if (userSubscription.type === 'demo') {
        const hasInvalidDates = Object.keys(appData.schedule).some(date => {
            const day = parseInt(date.split('.')[0]);
            return day > 7;
        });
        
        if (hasInvalidDates) {
            alert('❌ В демо-режиме доступны только первые 7 дней месяца. Купите полный доступ для работы со всеми датами.');
            showTab('payment');
            return false;
        }
    }
    
    return true;
}

// Обновите функцию generateSchedule
function generateSchedule() {
    console.log("Генерируем расписание...");
    
    // Проверка доступа
    if (!checkAccess()) {
        return;
    }
    
    if (appData.employees.length === 0) {
        alert('❌ Сначала добавьте сотрудников');
        return;
    }
    
    if (Object.keys(appData.schedule).length === 0) {
        alert('❌ Сначала загрузите расписание');
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
            
            // Уменьшаем счетчик генераций для платных подписок
            if (userSubscription.type !== 'demo') {
                userSubscription.generationsLeft--;
                saveSubscription();
                updateStatusDisplay();
            }
            
            alert('✅ Расписание успешно сгенерировано!');
            
        } catch (error) {
            console.error('Ошибка:', error);
            alert('❌ Ошибка: ' + error.message);
        } finally {
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('generateBtn').disabled = false;
        }
    }, 500);
}

// Обновите инициализацию
document.addEventListener('DOMContentLoaded', function() {
    console.log("Приложение загружено!");
    
    // Инициализация Telegram Web App
    if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        console.log("Telegram Web App инициализирован");
    }
    // Построение таблицы с учетом отдыха после суточных нарядов
function buildTable() {
    const table = document.getElementById('calendarTable');
    const results = appData.results;
    
    // Собираем все даты из расписания (только те, где есть наряды)
    const allDates = new Set();
    Object.keys(appData.schedule).forEach(date => allDates.add(date));
    
    // Добавляем дни отдыха после суточных нарядов
    results.assigned.forEach(shift => {
        if (shift.type !== 7) { // Суточные наряды
            allDates.add(getNextDay(shift.date));
        }
    });
    
    const dates = Array.from(allDates).sort();
    
    // Заголовок
    let html = '<tr><th class="employee-cell">Сотрудник</th>';
    dates.forEach(date => {
        html += `<th title="${date}">${date.split('.')[0]}</th>`;
    });
    html += '<th>Итого</th></tr>';
    
    // Данные сотрудников
    for (const employee of appData.employees) {
        let row = `<tr><td class="employee-cell">${employee.name}</td>`;
        let totalShifts = 0;
        
        for (const date of dates) {
            let content = '';
            let cellClass = '';
            
            // Проверяем отпуск
            if (employee.vacationDays.includes(date)) {
                content = 'Х';
                cellClass = 'vacation-cell';
            } 
            // Проверяем назначенный наряд в эту дату
            else {
                const shiftOnThisDate = results.assigned.find(s => s.date === date && s.employee === employee.name);
                if (shiftOnThisDate) {
                    content = shiftOnThisDate.type;
                    cellClass = 'shift-cell';
                    totalShifts++;
                } 
                // Проверяем день отдыха после суточного наряда (только если нет наряда в этот день)
                else {
                    const prevDate = getPrevDay(date);
                    const prevDayShift = results.assigned.find(s => 
                        s.date === prevDate && 
                        s.employee === employee.name && 
                        s.type !== 7 // Только суточные наряды
                    );
                    if (prevDayShift) {
                        content = '*';
                        cellClass = 'rest-cell';
                    }
                }
            }
            
            row += `<td class="${cellClass}">${content}</td>`;
        }
        
        row += `<td><strong>${totalShifts}</strong></td></tr>`;
        html += row;
    }
    
    // Нераспределенные наряды
    if (results.unassigned.length > 0) {
        let row = '<tr><td class="employee-cell" style="background:#e74c3c;color:white;">Нераспределенные</td>';
        
        for (const date of dates) {
            const count = results.unassigned.filter(s => s.date === date).length;
            if (count > 0) {
                row += `<td class="unassigned-cell">${count}</td>`;
            } else {
                row += '<td></td>';
            }
        }
        
        row += `<td><strong>${results.unassigned.length}</strong></td></tr>`;
        html += row;
    }
    
    table.innerHTML = html;
}
    // Инициализация интерфейса
    initTabs();
    initEmployeeFields();
    setupEventListeners();
    initSubscriptionSystem(); // Добавить эту строку!
    
    console.log("Приложение готово к работе");
});