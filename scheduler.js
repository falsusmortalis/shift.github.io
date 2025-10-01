// Простой и рабочий планировщик
class ShiftScheduler {
    constructor() {
        this.employees = [];
        this.assignedShifts = [];
        this.unassignedShifts = [];
        this.employeeStats = new Map();
    }

    addEmployee(name, vacationDays = [], priority = 0) {
        const employee = {
            id: this.employees.length + 1,
            name: name,
            vacationDays: vacationDays,
            priority: priority
        };
        
        this.employees.push(employee);
        this.employeeStats.set(employee.id, {
            shiftsCount: 0,
            monthlySlots: 15
        });
        
        return employee.id;
    }

    generateSchedule(dailyShifts) {
        console.log("Начинаем распределение...");
        this.assignedShifts = [];
        this.unassignedShifts = [];
        
        // Сбрасываем статистику
        this.employeeStats.clear();
        this.employees.forEach(emp => {
            this.employeeStats.set(emp.id, {
                shiftsCount: 0,
                monthlySlots: 15
            });
        });

        // Создаем все наряды
        const allShifts = [];
        for (const [dateStr, shiftTypes] of Object.entries(dailyShifts)) {
            for (const type of shiftTypes) {
                allShifts.push({
                    date: dateStr,
                    type: type
                });
            }
        }

        console.log(`Всего нарядов для распределения: ${allShifts.length}`);

        // Простой алгоритм распределения
        for (const shift of allShifts) {
            let assigned = false;
            
            // Пробуем назначить наряд сотрудникам по очереди
            for (const employee of this.employees) {
                if (this.canAssignShift(employee, shift)) {
                    this.assignShift(employee, shift);
                    assigned = true;
                    break;
                }
            }
            
            if (!assigned) {
                this.unassignedShifts.push(shift);
            }
        }
        
        console.log("Распределение завершено!");
    }

    canAssignShift(employee, shift) {
        const stats = this.employeeStats.get(employee.id);
        
        // Проверяем отпуск
        if (employee.vacationDays.includes(shift.date)) {
            return false;
        }
        
        // Проверяем лимит для суточных нарядов
        if (shift.type !== 7 && stats.monthlySlots <= 0) {
            return false;
        }
        
        return true;
    }

    assignShift(employee, shift) {
        const assignedShift = {
            ...shift,
            employeeId: employee.id,
            employeeName: employee.name
        };
        
        this.assignedShifts.push(assignedShift);
        
        const stats = this.employeeStats.get(employee.id);
        stats.shiftsCount++;
        
        if (shift.type !== 7) {
            stats.monthlySlots--;
        }
        
        console.log(`Назначен наряд: ${shift.date} тип ${shift.type} → ${employee.name}`);
    }

    getStatistics() {
        return {
            totalEmployees: this.employees.length,
            totalAssigned: this.assignedShifts.length,
            totalUnassigned: this.unassignedShifts.length,
            totalRequested: this.assignedShifts.length + this.unassignedShifts.length
        };
    }
}
