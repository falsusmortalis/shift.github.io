from datetime import datetime, timedelta
from collections import defaultdict
from typing import List, Dict, Optional

class Employee:
    """Класс для представления сотрудника"""
    def __init__(self, id: int, name: str, priority: int = 0):
        self.id = id
        self.name = name
        self.priority = priority
        self.vacation_days: List[datetime] = []
        self.preferred_exclusion_days: List[datetime] = []

class Shift:
    """Класс для представления наряда"""
    def __init__(self, date: datetime, shift_type: int, employee_id: Optional[int] = None):
        self.date = date
        self.type = shift_type
        self.employee_id = employee_id
        # Наряды типа 1-6 заканчиваются на следующий день в 9:00
        # Наряд типа 7 (8 часов) заканчивается в тот же день
        self.end_date = date + timedelta(days=1) if shift_type in [1, 2, 3, 4, 5, 6] else date

class ShiftScheduler:
    """Основной класс для распределения нарядов"""
    def __init__(self):
        self.employees: List[Employee] = []
        self.assigned_shifts: List[Shift] = []
        self.unassigned_shifts: List[Shift] = []
        self.employee_stats = defaultdict(lambda: {
            'shifts_count': 0, 
            'occupied_days': set(), 
            'monthly_slots': 15
        })
    
    def add_employee(self, name: str, vacation_days: List[datetime] = None, 
                     preferred_exclusion_days: List[datetime] = None, priority: int = 0) -> int:
        """Добавить сотрудника в систему"""
        employee_id = len(self.employees) + 1
        employee = Employee(employee_id, name, priority)
        if vacation_days:
            employee.vacation_days = vacation_days
        if preferred_exclusion_days:
            employee.preferred_exclusion_days = preferred_exclusion_days
        self.employees.append(employee)
        return employee_id

    def generate_schedule(self, daily_shifts: Dict[datetime, List[int]]):
        """Распределение нарядов с учетом всех ограничений"""
        self.assigned_shifts = []
        self.unassigned_shifts = []
        
        # Сбрасываем статистику сотрудников
        for employee in self.employees:
            self.employee_stats[employee.id] = {
                'shifts_count': 0, 
                'occupied_days': set(), 
                'monthly_slots': 15
            }
        
        # Создаем список всех нарядов для распределения
        all_shifts = []
        for date, shift_types in daily_shifts.items():
            for shift_type in shift_types:
                all_shifts.append(Shift(date, shift_type))
        
        # Сортируем наряды по дате для последовательного распределения
        all_shifts.sort(key=lambda x: x.date)
        
        # Распределяем наряды
        for shift in all_shifts:
            available_employees = self._get_available_employees(shift)
            
            if available_employees:
                # Выбираем сотрудника с учетом приоритета и количества нарядов
                # Сотрудники с более высоким приоритетом получают наряды в первую очередь
                available_employees.sort(key=lambda emp: (
                    -emp.priority,
                    self.employee_stats[emp.id]['shifts_count']
                ))
                employee = available_employees[0]
                
                # Назначаем наряд
                shift.employee_id = employee.id
                self.assigned_shifts.append(shift)
                
                # Обновляем статистику
                self.employee_stats[employee.id]['shifts_count'] += 1
                
                # Отмечаем занятые дни
                shift_days = self._get_shift_days(shift)
                self.employee_stats[employee.id]['occupied_days'].update(shift_days)
                
                # Уменьшаем доступные слоты для суточных нарядов
                if shift.type in [1, 2, 3, 4, 5, 6]:
                    self.employee_stats[employee.id]['monthly_slots'] -= 1
            else:
                # Нет доступных сотрудников - добавляем в нераспределенные
                self.unassigned_shifts.append(shift)
    
    def _get_shift_days(self, shift: Shift) -> List[datetime]:
        """Возвращает список дней, которые занимает наряд"""
        if shift.type in [1, 2, 3, 4, 5, 6]:
            # Суточный наряд занимает текущий день и следующий
            return [shift.date, shift.date + timedelta(days=1)]
        else:
            # 8-часовой наряд занимает только текущий день
            return [shift.date]
    
    def _get_available_employees(self, shift: Shift) -> List[Employee]:
        """Поиск сотрудников, доступных для этого наряда"""
        available = []
        shift_days = self._get_shift_days(shift)
        
        for employee in self.employees:
            # 1. Проверка отпуска
            if any(any(vacation.date() == day.date() for vacation in employee.vacation_days) 
                   for day in shift_days):
                continue
            
            # 2. Проверка предпочтительных дат исключения (учитываем, но не блокируем жестко)
            # Если есть другие доступные сотрудники, пропускаем этого
            has_preferred_exclusion = any(
                any(excl.date() == day.date() for excl in employee.preferred_exclusion_days) 
                for day in shift_days
            )
            
            # 3. Проверка лимита суточных нарядов (15 в месяц)
            if shift.type in [1, 2, 3, 4, 5, 6] and self.employee_stats[employee.id]['monthly_slots'] <= 0:
                continue
            
            # 4. Проверка что сотрудник не занят в эти дни другими нарядами
            if any(day in self.employee_stats[employee.id]['occupied_days'] for day in shift_days):
                continue
            
            # Добавляем в список, отмечая предпочтения
            available.append((employee, has_preferred_exclusion))
        
        # Сначала пытаемся выбрать тех, у кого нет предпочтений исключения
        preferred_available = [emp for emp, has_excl in available if not has_excl]
        if preferred_available:
            return preferred_available
        
        # Если таких нет, возвращаем всех доступных
        return [emp for emp, _ in available]

    def analyze_unassigned_reason(self, shift: Shift) -> str:
        """Анализирует причину нераспределенного наряда"""
        shift_days = self._get_shift_days(shift)
        
        # Проверяем, есть ли вообще сотрудники не в отпуске в эти дни
        available_employees = []
        for emp in self.employees:
            if not any(any(vac.date() == day.date() for vac in emp.vacation_days) for day in shift_days):
                available_employees.append(emp)
        
        if not available_employees:
            return "Все сотрудники в отпуске"
        
        # Проверяем лимит суточных нарядов
        if shift.type in [1, 2, 3, 4, 5, 6]:
            overloaded_count = 0
            for emp in available_employees:
                if self.employee_stats[emp.id]['monthly_slots'] <= 0:
                    overloaded_count += 1
            
            if overloaded_count == len(available_employees):
                return "Все доступные достигли лимита (15 нарядов)"
        
        # Проверяем занятость
        busy_count = 0
        for emp in available_employees:
            if any(day in self.employee_stats[emp.id]['occupied_days'] for day in shift_days):
                busy_count += 1
        
        if busy_count == len(available_employees):
            return "Все доступные заняты в эти дни"
        
        return "Недостаточно сотрудников"

    def get_statistics(self) -> Dict:
        """Получить статистику распределения"""
        stats = {
            'total_employees': len(self.employees),
            'total_assigned': len(self.assigned_shifts),
            'total_unassigned': len(self.unassigned_shifts),
            'employee_loads': []
        }
        
        for employee in self.employees:
            employee_shifts = [s for s in self.assigned_shifts if s.employee_id == employee.id]
            stats['employee_loads'].append({
                'name': employee.name,
                'shifts': len(employee_shifts),
                'remaining_slots': self.employee_stats[employee.id]['monthly_slots']
            })
        
        return stats
