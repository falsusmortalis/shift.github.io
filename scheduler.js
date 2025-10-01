class Employee {
    constructor(id, name, priority = 0) {
        this.id = id;
        this.name = name;
        this.priority = priority;
        this.vacationDays = [];
        this.preferredExclusionDays = [];
    }
}

class Shift {
    constructor(date, type, employeeId = null) {
        this.date = new Date(date);
        this.type = type;
        this.employeeId = employeeId;
        // Наряды 1-6 заканчиваются на следующий день, тип 7 - в тот же день
        this.endDate = type !== 7 ? 
            new Date(date.getTime() + 24 * 60 * 60 * 1000) : 
            new Date(date);
    }
}

class ShiftScheduler {
    constructor() {
        this.employees = [];
        this.assignedShifts = [];
        this.unassignedShifts = [];
        this.employeeStats = new Map();
    }

    addEmployee(name, vacationDays = [], preferredExclusionDays = [], priority = 0) {
        const employeeId = this.employees.length + 1;
        const employee = new Employee(employeeId, name, priority);
        
        employee.vacationDays = vacationDays.map(d => new Date(d));
        employee.preferredExclusionDays = preferredExclusionDays.map(d => new Date(d));
        
        this.employees.push(employee);
        this.employeeStats.set(employeeId, {
            shiftsCount: 0,
            occupiedDays: new Set(),
            monthlySlots: 15
        });
        
        return employeeId;
    }

    generateSchedule(dailyShifts) {
        this.assignedShifts = [];
        this.unassignedShifts = [];
        
        // Сбрасываем статистику
        this.employeeStats.clear();
        this.employees.forEach(emp => {
            this.employeeStats.set(emp.id, {
                shiftsCount: 0,
                occupiedDays: new Set(),
                monthlySlots: 15
            });
        });

        // Создаем все наряды
        const allShifts = [];
        Object.entries(dailyShifts).forEach(([dateStr, shiftTypes]) => {
            const date = this.parseDate(dateStr);
            shiftTypes.forEach(type => {
                allShifts.push(new Shift(date, type));
            });
        });

        // Сортируем по дате
        allShifts.sort((a, b) => a.date - b.date);

        // Распределяем наряды
        allShifts.forEach(shift => {
            const availableEmployees = this.getAvailableEmployees(shift);
            
            if (availableEmployees.length > 0) {
                // Выбираем лучшего сотрудника
                availableEmployees.sort((a, b) => {
                    const aStats = this.employeeStats.get(a.id);
                    const bStats = this.employeeStats.get(b.id);
                    
                    // Сначала по приоритету (высокий лучше)
                    if (a.priority !== b.priority) {
                        return b.priority - a.priority;
                    }
                    // Затем по количеству нарядов (меньше лучше)
                    return aStats.shiftsCount - bStats.shiftsCount;
                });

                const bestEmployee = availableEmployees[0];
                this.assignShiftToEmployee(shift, bestEmployee);
            } else {
                this.unassignedShifts.push(shift);
            }
        });
    }

    getAvailableEmployees(shift) {
        const shiftDays = this.getShiftDays(shift);
        const available = [];

        this.employees.forEach(employee => {
            const stats = this.employeeStats.get(employee.id);
            
            // 1. Проверка отпуска
            const isOnVacation = shiftDays.some(day => 
                employee.vacationDays.some(vacation => 
                    this.isSameDay(vacation, day)
                )
            );
            
            if (isOnVacation) return;

            // 2. Проверка лимита суточных нарядов
            if (shift.type !== 7 && stats.monthlySlots <= 0) return;

            // 3. Проверка занятости
            const isBusy = shiftDays.some(day => stats.occupiedDays.has(day.getTime()));
            if (isBusy) return;

            // 4. Проверка предпочтительных дней исключения (мягкое ограничение)
            const hasPreferredExclusion = shiftDays.some(day => 
                employee.preferredExclusionDays.some(excl => 
                    this.isSameDay(excl, day)
                )
            );

            available.push({
                employee,
                hasPreferredExclusion
            });
        });

        // Сначала возвращаем сотрудников без предпочтений исключения
        const withoutExclusion = available.filter(a => !a.hasPreferredExclusion).map(a => a.employee);
        if (withoutExclusion.length > 0) return withoutExclusion;

        // Если таких нет, возвращаем всех
        return available.map(a => a.employee);
    }

    assignShiftToEmployee(shift, employee) {
        shift.employeeId = employee.id;
        this.assignedShifts.push(shift);
        
        const stats = this.employeeStats.get(employee.id);
        stats.shiftsCount++;
        
        // Отмечаем занятые дни
        const shiftDays = this.getShiftDays(shift);
        shiftDays.forEach(day => {
            stats.occupiedDays.add(day.getTime());
        });
        
        // Уменьшаем слоты для суточных нарядов
        if (shift.type !== 7) {
            stats.monthlySlots--;
        }
    }

    getShiftDays(shift) {
        if (shift.type === 7) {
            return [shift.date];
        } else {
            return [shift.date, new Date(shift.date.getTime() + 24 * 60 * 60 * 1000)];
        }
    }

    isSameDay(date1, date2) {
        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    }

    parseDate(dateStr) {
        const [day, month, year] = dateStr.split('.').map(Number);
        return new Date(year, month - 1, day);
    }

    formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }

    analyzeUnassignedReason(shift) {
        const shiftDays = this.getShiftDays(shift);
        
        // Проверяем сотрудников не в отпуске
        const availableEmployees = this.employees.filter(emp => 
            !shiftDays.some(day => 
                emp.vacationDays.some(vacation => this.isSameDay(vacation, day))
            )
        );

        if (availableEmployees.length === 0) return "Все сотрудники в отпуске";

        // Проверяем лимит
        if (shift.type !== 7) {
            const overloadedCount = availableEmployees.filter(emp => {
                const stats = this.employeeStats.get(emp.id);
                return stats.monthlySlots <= 0;
            }).length;

            if (overloadedCount === availableEmployees.length) return "Достигнут лимит нарядов";
        }

        // Проверяем занятость
        const busyCount = availableEmployees.filter(emp => {
            const stats = this.employeeStats.get(emp.id);
            return shiftDays.some(day => stats.occupiedDays.has(day.getTime()));
        }).length;

        if (busyCount === availableEmployees.length) return "Все сотрудники заняты";

        return "Недостаточно сотрудников";
    }

    getStatistics() {
        const totalRequested = this.assignedShifts.length + this.unassignedShifts.length;
        
        return {
            total_employees: this.employees.length,
            total_assigned: this.assignedShifts.length,
            total_unassigned: this.unassignedShifts.length,
            total_requested: totalRequested,
            employee_loads: this.employees.map(emp => {
                const stats = this.employeeStats.get(emp.id);
                return {
                    name: emp.name,
                    shifts: stats.shiftsCount,
                    remaining_slots: stats.monthlySlots
                };
            })
        };
    }
}
