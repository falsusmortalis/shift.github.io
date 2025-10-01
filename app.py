import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
from scheduler import ShiftScheduler, Employee, Shift
import io
import json
import plotly.express as px
import plotly.graph_objects as go
from license_manager import LicenseManager

# Настройка страницы
st.set_page_config(
    page_title="Распределение нарядов",
    page_icon="attached_assets/icon_1759269491927.ico",
    layout="wide"
)

# Добавление фоновых изображений с CSS
st.markdown("""
<style>
    /* Основной фон приложения */
    .stApp {
        background-image: url('app/attached_assets/photo_2025-10-01_01-05-46_1759269980242.jpg');
        background-size: cover;
        background-position: center;
        background-attachment: fixed;
        background-repeat: no-repeat;
    }
    
    /* Прозрачный слой поверх фона */
    .stApp::before {
        content: "";
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.92);
        z-index: -1;
    }
    
    /* Стиль для боковой панели с первым изображением */
    [data-testid="stSidebar"] {
        background-image: url('app/attached_assets/photo_2025-10-01_01-03-18_1759269824467.jpg');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
    }
    
    /* Прозрачный слой поверх боковой панели */
    [data-testid="stSidebar"]::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.88);
        z-index: -1;
    }
    
    /* Стиль для улучшения читаемости текста */
    .stMarkdown, .stDataFrame, .stMetric {
        background: rgba(255, 255, 255, 0.7);
        padding: 10px;
        border-radius: 5px;
    }
</style>
""", unsafe_allow_html=True)

# Инициализация license manager
license_manager = LicenseManager()

# Инициализация session state
if 'scheduler' not in st.session_state:
    st.session_state.scheduler = None
if 'daily_shifts' not in st.session_state:
    st.session_state.daily_shifts = None
if 'employees_data' not in st.session_state:
    st.session_state.employees_data = []
if 'schedule_generated' not in st.session_state:
    st.session_state.schedule_generated = False
if 'authenticated' not in st.session_state:
    st.session_state.authenticated = False
if 'license_data' not in st.session_state:
    st.session_state.license_data = None
if 'session_id' not in st.session_state:
    st.session_state.session_id = None

def parse_date_list(date_string: str):
    """Парсинг списка дат из строки"""
    dates = []
    if not date_string.strip():
        return dates
    
    for date_str in date_string.split(','):
        date_str = date_str.strip()
        if date_str:
            try:
                date = datetime.strptime(date_str, "%d.%m.%Y")
                dates.append(date)
            except ValueError:
                st.warning(f"Неверный формат даты: {date_str}. Используйте ДД.ММ.ГГГГ")
    return dates

def read_schedule_from_csv(uploaded_file):
    """Чтение расписания из загруженного CSV файла"""
    daily_shifts = {}
    
    try:
        # Читаем файл с учетом BOM
        content = uploaded_file.read().decode('utf-8-sig')
        lines = content.strip().split('\n')
        
        # Пропускаем заголовок
        for line in lines[1:]:
            if not line.strip():
                continue
                
            parts = line.split(';')
            if len(parts) < 2:
                continue
            
            date_str = parts[0].strip()
            shifts_str = parts[1].strip()
            
            try:
                date = datetime.strptime(date_str, "%d.%m.%Y")
                shift_types = []
                
                if shifts_str:
                    for shift_str in shifts_str.split(','):
                        shift_type = int(shift_str.strip())
                        if 1 <= shift_type <= 7:
                            shift_types.append(shift_type)
                
                daily_shifts[date] = shift_types
                
            except ValueError:
                continue
        
        return daily_shifts
        
    except Exception as e:
        st.error(f"Ошибка чтения файла: {e}")
        return {}

def create_calendar_table(scheduler, daily_shifts):
    """Создание календарной таблицы для отображения"""
    if not daily_shifts:
        return None
    
    # Получаем все даты
    dates = sorted(daily_shifts.keys())
    all_dates = set()
    for date in dates:
        all_dates.add(date)
        if any(s.type in [1, 2, 3, 4, 5, 6] for s in scheduler.assigned_shifts if s.date == date):
            all_dates.add(date + timedelta(days=1))
    
    all_dates = sorted(all_dates)
    
    # Создаем DataFrame
    data = []
    for employee in scheduler.employees:
        row = {'ФИО': employee.name}
        
        for date in all_dates:
            cell = ''
            
            # Проверяем отпуск
            if any(vacation.date() == date.date() for vacation in employee.vacation_days):
                cell = 'Х'
            else:
                # Ищем наряды
                for shift in scheduler.assigned_shifts:
                    if shift.employee_id == employee.id:
                        shift_days = [shift.date, shift.date + timedelta(days=1)] if shift.type in [1,2,3,4,5,6] else [shift.date]
                        if date in shift_days:
                            if shift.date == date:
                                cell = str(shift.type)
                            else:
                                cell = '*'
                            break
            
            row[date.strftime('%d.%m')] = cell
        
        # Добавляем статистику
        row['Итого'] = scheduler.employee_stats[employee.id]['shifts_count']
        row['Осталось слотов'] = scheduler.employee_stats[employee.id]['monthly_slots']
        
        data.append(row)
    
    df = pd.DataFrame(data)
    return df

def export_to_csv(scheduler, daily_shifts):
    """Экспорт результатов в CSV"""
    # Создаем таблицу распределения
    df = create_calendar_table(scheduler, daily_shifts)
    
    # Создаем файл с нераспределенными нарядами
    unassigned_data = []
    for shift in scheduler.unassigned_shifts:
        reason = scheduler.analyze_unassigned_reason(shift)
        unassigned_data.append({
            'Дата': shift.date.strftime('%d.%m.%Y'),
            'Тип наряда': shift.type,
            'Причина': reason
        })
    
    unassigned_df = pd.DataFrame(unassigned_data)
    
    return df, unassigned_df

def save_employees_profile(employees_data):
    """Сохранение профиля сотрудников в JSON"""
    profile = {
        'employees': employees_data,
        'saved_at': datetime.now().strftime('%d.%m.%Y %H:%M:%S')
    }
    return json.dumps(profile, ensure_ascii=False, indent=2)

def load_employees_profile(uploaded_file):
    """Загрузка профиля сотрудников из JSON"""
    try:
        content = uploaded_file.read().decode('utf-8')
        profile = json.loads(content)
        
        if 'employees' in profile:
            return profile['employees']
        else:
            st.error("Неверный формат файла профиля")
            return None
    except Exception as e:
        st.error(f"Ошибка загрузки профиля: {e}")
        return None

def create_workload_bar_chart(scheduler):
    """Создание столбчатой диаграммы нагрузки сотрудников"""
    data = []
    for employee in scheduler.employees:
        data.append({
            'Сотрудник': employee.name,
            'Нарядов': scheduler.employee_stats[employee.id]['shifts_count']
        })
    
    df = pd.DataFrame(data)
    fig = px.bar(
        df, 
        x='Сотрудник', 
        y='Нарядов',
        title='Распределение нарядов по сотрудникам',
        labels={'Нарядов': 'Количество нарядов'},
        color='Нарядов',
        color_continuous_scale='Blues'
    )
    fig.update_layout(showlegend=False)
    return fig

def create_slots_pie_chart(scheduler):
    """Создание круговой диаграммы использования слотов"""
    total_slots = len(scheduler.employees) * 15
    used_slots = sum(15 - scheduler.employee_stats[emp.id]['monthly_slots'] for emp in scheduler.employees)
    remaining_slots = total_slots - used_slots
    
    fig = go.Figure(data=[go.Pie(
        labels=['Использовано', 'Доступно'],
        values=[used_slots, remaining_slots],
        hole=.3,
        marker_colors=['#1f77b4', '#d3d3d3']
    )])
    fig.update_layout(title='Использование слотов нарядов')
    return fig

def create_daily_distribution_chart(scheduler, daily_shifts):
    """Создание графика распределения нарядов по дням"""
    dates = sorted(daily_shifts.keys())
    
    daily_counts = []
    for date in dates:
        assigned_count = sum(1 for shift in scheduler.assigned_shifts if shift.date == date)
        total_count = len(daily_shifts[date])
        daily_counts.append({
            'Дата': date.strftime('%d.%m'),
            'Распределено': assigned_count,
            'Всего': total_count
        })
    
    df = pd.DataFrame(daily_counts)
    fig = go.Figure()
    fig.add_trace(go.Bar(x=df['Дата'], y=df['Всего'], name='Всего нарядов', marker_color='lightblue'))
    fig.add_trace(go.Bar(x=df['Дата'], y=df['Распределено'], name='Распределено', marker_color='blue'))
    
    fig.update_layout(
        title='Распределение нарядов по дням',
        xaxis_title='Дата',
        yaxis_title='Количество нарядов',
        barmode='overlay',
        showlegend=True
    )
    return fig

def create_employee_timeline(scheduler, daily_shifts):
    """Создание временной шкалы нарядов для каждого сотрудника"""
    data = []
    
    for employee in scheduler.employees:
        employee_shifts = [s for s in scheduler.assigned_shifts if s.employee_id == employee.id]
        for shift in employee_shifts:
            start_date = shift.date
            if shift.type in [1, 2, 3, 4, 5, 6]:
                end_date = shift.date + timedelta(days=2)
                shift_label = f"Наряд {shift.type}"
            else:
                end_date = shift.date + timedelta(hours=8)
                shift_label = f"Наряд 7 (8ч)"
            
            data.append({
                'Сотрудник': employee.name,
                'Начало': start_date,
                'Конец': end_date,
                'Наряд': shift_label
            })
    
    if data:
        df = pd.DataFrame(data)
        fig = px.timeline(
            df, 
            x_start='Начало', 
            x_end='Конец', 
            y='Сотрудник', 
            color='Наряд',
            title='Временная шкала нарядов'
        )
        fig.update_yaxes(categoryorder='total ascending')
        return fig
    return None

def export_to_excel(scheduler, daily_shifts):
    """Экспорт результатов в Excel с форматированием"""
    output = io.BytesIO()
    
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        # Лист 1: Календарная таблица
        df = create_calendar_table(scheduler, daily_shifts)
        if df is not None:
            df.to_excel(writer, sheet_name='Распределение', index=False)
            
            # Форматирование
            workbook = writer.book
            worksheet = writer.sheets['Распределение']
            
            # Форматы
            header_format = workbook.add_format({
                'bold': True,
                'bg_color': '#4472C4',
                'font_color': 'white',
                'border': 1,
                'align': 'center'
            })
            
            vacation_format = workbook.add_format({
                'bg_color': '#FFC7CE',
                'border': 1,
                'align': 'center'
            })
            
            shift_format = workbook.add_format({
                'bg_color': '#C6EFCE',
                'border': 1,
                'align': 'center'
            })
            
            rest_format = workbook.add_format({
                'bg_color': '#FFEB9C',
                'border': 1,
                'align': 'center'
            })
            
            # Применяем форматирование к заголовкам
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)
                worksheet.set_column(col_num, col_num, 12)
            
            # Условное форматирование для ячеек
            for row_num in range(1, len(df) + 1):
                for col_num in range(1, len(df.columns) - 2):
                    cell_value = df.iloc[row_num - 1, col_num]
                    if cell_value == 'Х':
                        worksheet.write(row_num, col_num, cell_value, vacation_format)
                    elif cell_value == '*':
                        worksheet.write(row_num, col_num, cell_value, rest_format)
                    elif cell_value and cell_value != '':
                        worksheet.write(row_num, col_num, cell_value, shift_format)
        
        # Лист 2: Статистика
        stats_data = []
        for employee in scheduler.employees:
            stats_data.append({
                'Сотрудник': employee.name,
                'Приоритет': employee.priority,
                'Нарядов': scheduler.employee_stats[employee.id]['shifts_count'],
                'Осталось слотов': scheduler.employee_stats[employee.id]['monthly_slots'],
                'Занято дней': len(scheduler.employee_stats[employee.id]['occupied_days'])
            })
        
        stats_df = pd.DataFrame(stats_data)
        stats_df.to_excel(writer, sheet_name='Статистика', index=False)
        
        # Форматирование статистики
        stats_worksheet = writer.sheets['Статистика']
        for col_num, value in enumerate(stats_df.columns.values):
            stats_worksheet.write(0, col_num, value, header_format)
            stats_worksheet.set_column(col_num, col_num, 18)
        
        # Лист 3: Нераспределенные наряды
        if scheduler.unassigned_shifts:
            unassigned_data = []
            for shift in scheduler.unassigned_shifts:
                reason = scheduler.analyze_unassigned_reason(shift)
                unassigned_data.append({
                    'Дата': shift.date.strftime('%d.%m.%Y'),
                    'Тип наряда': shift.type,
                    'Дни': '2 дня (с отдыхом)' if shift.type in [1,2,3,4,5,6] else '8 часов',
                    'Причина': reason
                })
            
            unassigned_df = pd.DataFrame(unassigned_data)
            unassigned_df.to_excel(writer, sheet_name='Нераспределенные', index=False)
            
            # Форматирование нераспределенных
            unassigned_worksheet = writer.sheets['Нераспределенные']
            for col_num, value in enumerate(unassigned_df.columns.values):
                unassigned_worksheet.write(0, col_num, value, header_format)
                unassigned_worksheet.set_column(col_num, col_num, 25)
    
    output.seek(0)
    return output.getvalue()

# Проверка лицензии
if not st.session_state.authenticated:
    st.title("🔐 Активация доступа")
    st.markdown("---")
    
    tab1, tab2 = st.tabs(["🔑 Лицензионный ключ", "⏱️ Демо (3 часа)"])
    
    with tab1:
        st.subheader("Активация полного доступа")
        st.info("**Полный доступ включает:**\n- 10 генераций расписания в месяц\n- Экспорт в Excel и CSV\n- Без ограничений по времени")
        
        license_key = st.text_input(
            "Введите лицензионный ключ:",
            placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX",
            help="Формат: 24 символа с дефисами"
        )
        
        if st.button("🚀 Активировать лицензию", use_container_width=True):
            is_valid, result = license_manager.validate_license(license_key)
            if is_valid:
                st.session_state.authenticated = True
                st.session_state.license_data = result
                st.success("✅ Лицензия успешно активирована!")
                st.rerun()
            else:
                st.error(f"❌ {result}")
    
    with tab2:
        st.subheader("Демо-доступ (3 часа)")
        st.info("**Демо-доступ включает:**\n- Полный функционал на 3 часа\n- Без возможности скачивания файлов\n- Идеально для тестирования")
        
        if st.button("▶️ Начать демо", use_container_width=True):
            session_id, expiry_time = license_manager.start_demo_session()
            st.session_state.authenticated = True
            st.session_state.session_id = session_id
            st.session_state.license_data = {
                "type": "demo",
                "expiry": expiry_time.isoformat(),
                "can_download": False
            }
            st.success(f"✅ Демо-доступ активирован до {expiry_time.strftime('%H:%M')}")
            st.rerun()
    
    st.markdown("---")
    st.caption("Для получения лицензионного ключа обратитесь к администратору")
    st.stop()

# Проверка валидности сессии
if st.session_state.license_data:
    license_type = st.session_state.license_data.get("type") if isinstance(st.session_state.license_data, dict) else None
    
    if license_type == "demo":
        # Проверяем демо-сессию
        is_valid, result = license_manager.validate_demo_session(st.session_state.session_id)
        if not is_valid:
            st.error(f"⏰ {result}")
            st.session_state.authenticated = False
            st.session_state.license_data = None
            st.session_state.session_id = None
            st.rerun()
        else:
            # result это словарь с данными лицензии
            st.session_state.license_data = result
    elif license_type == "full":
        # Проверяем лицензию
        license_key = st.session_state.license_data.get("license_key")
        is_valid, result = license_manager.validate_license(license_key)
        if not is_valid:
            st.error(f"❌ {result}")
            st.session_state.authenticated = False
            st.session_state.license_data = None
            st.rerun()
        else:
            # result это словарь с данными лицензии
            st.session_state.license_data = result

# Заголовок приложения
st.title("📋 Система распределения нарядов")

# Показываем статус лицензии
if st.session_state.license_data:
    license_type = st.session_state.license_data.get("type")
    
    if license_type == "demo":
        st.warning(f"⏱️ Демо-режим | Осталось: {st.session_state.license_data.get('time_remaining')} | Скачивание отключено")
    else:
        remaining = st.session_state.license_data.get('remaining_generations', 0)
        used = st.session_state.license_data.get('used_generations', 0)
        total = st.session_state.license_data.get('monthly_limit', 10)
        
        if remaining <= 2:
            st.error(f"⚠️ Полный доступ | Генераций осталось: {remaining}/{total}")
        elif remaining <= 5:
            st.warning(f"🔑 Полный доступ | Генераций осталось: {remaining}/{total}")
        else:
            st.success(f"✅ Полный доступ | Генераций осталось: {remaining}/{total}")

st.markdown("---")

# Боковая панель для ввода данных
with st.sidebar:
    st.header("⚙️ Настройки")
    
    # Показываем статус лицензии и кнопку выхода
    if st.session_state.authenticated and st.session_state.license_data:
        license_type = st.session_state.license_data.get("type")
        
        with st.expander("🔑 Статус лицензии", expanded=False):
            if license_type == "demo":
                st.info(f"**Демо-режим**\n\nОсталось: {st.session_state.license_data.get('time_remaining')}")
            else:
                remaining = st.session_state.license_data.get('remaining_generations', 0)
                total = st.session_state.license_data.get('monthly_limit', 10)
                st.success(f"**Полный доступ**\n\nГенераций: {remaining}/{total}")
            
            if st.button("🚪 Выйти", use_container_width=True):
                st.session_state.authenticated = False
                st.session_state.license_data = None
                st.session_state.session_id = None
                st.rerun()
    
    st.markdown("---")
    
    # Секция 1: Загрузка расписания
    st.subheader("1. Загрузка расписания")
    uploaded_file = st.file_uploader(
        "Выберите CSV файл с расписанием",
        type=['csv'],
        help="Формат: дата;наряды (например: 01.10.2025;1,2,3,4)"
    )
    
    if uploaded_file:
        st.session_state.daily_shifts = read_schedule_from_csv(uploaded_file)
        if st.session_state.daily_shifts:
            total_shifts = sum(len(shifts) for shifts in st.session_state.daily_shifts.values())
            st.success(f"✅ Загружено {len(st.session_state.daily_shifts)} дней, {total_shifts} нарядов")
    
    st.markdown("---")
    
    # Секция 2: Ввод сотрудников
    st.subheader("2. Сотрудники")
    
    # Загрузка/Сохранение профиля
    col1, col2 = st.columns(2)
    
    with col1:
        profile_file = st.file_uploader(
            "Загрузить профиль",
            type=['json'],
            help="Загрузить сохраненный профиль сотрудников",
            key="profile_uploader"
        )
        
        if profile_file:
            loaded_data = load_employees_profile(profile_file)
            if loaded_data:
                st.session_state.employees_data = loaded_data
                st.success(f"✅ Загружено {len(loaded_data)} сотрудников")
                st.rerun()
    
    with col2:
        if st.session_state.employees_data and any(emp['name'].strip() for emp in st.session_state.employees_data):
            profile_json = save_employees_profile(st.session_state.employees_data)
            st.download_button(
                label="💾 Сохранить профиль",
                data=profile_json,
                file_name=f"профиль_сотрудников_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                mime="application/json",
                use_container_width=True
            )
    
    st.markdown("---")
    
    num_employees = st.number_input(
        "Количество сотрудников",
        min_value=1,
        max_value=50,
        value=len(st.session_state.employees_data) if st.session_state.employees_data else 2,
        step=1
    )
    
    # Динамическое создание полей для сотрудников
    employees_data = []
    for i in range(num_employees):
        with st.expander(f"Сотрудник {i+1}", expanded=(i < 2)):
            name = st.text_input(
                "Фамилия",
                key=f"name_{i}",
                value=st.session_state.employees_data[i]['name'] if i < len(st.session_state.employees_data) else ""
            )
            
            vacation_str = st.text_input(
                "Отпуск (через запятую)",
                key=f"vacation_{i}",
                placeholder="01.10.2025, 02.10.2025",
                help="Формат: ДД.ММ.ГГГГ",
                value=st.session_state.employees_data[i]['vacation'] if i < len(st.session_state.employees_data) else ""
            )
            
            exclusion_str = st.text_input(
                "Нежелательные даты (через запятую)",
                key=f"exclusion_{i}",
                placeholder="15.10.2025, 20.10.2025",
                help="Формат: ДД.ММ.ГГГГ",
                value=st.session_state.employees_data[i]['exclusion'] if i < len(st.session_state.employees_data) else ""
            )
            
            priority = st.slider(
                "Приоритет",
                min_value=0,
                max_value=10,
                value=st.session_state.employees_data[i]['priority'] if i < len(st.session_state.employees_data) and 'priority' in st.session_state.employees_data[i] else 0,
                key=f"priority_{i}",
                help="Чем выше приоритет, тем чаще сотрудник получает наряды. 0 - обычный, 10 - максимальный"
            )
            
            employees_data.append({
                'name': name,
                'vacation': vacation_str,
                'exclusion': exclusion_str,
                'priority': priority
            })
    
    st.session_state.employees_data = employees_data
    
    st.markdown("---")
    
    # Кнопка генерации расписания
    if st.button("🚀 Сгенерировать расписание", type="primary", use_container_width=True):
        if not st.session_state.daily_shifts:
            st.error("❌ Загрузите файл расписания")
        elif not any(emp['name'].strip() for emp in employees_data):
            st.error("❌ Добавьте хотя бы одного сотрудника")
        else:
            # Проверка лимита генераций для лицензионных пользователей
            can_generate = True
            
            license_type = st.session_state.license_data.get("type") if isinstance(st.session_state.license_data, dict) else None
            
            if license_type == "full":
                license_key = st.session_state.license_data.get("license_key")
                is_valid, message = license_manager.use_generation(license_key)
                
                if not is_valid:
                    st.error(f"❌ {message}")
                    can_generate = False
                else:
                    # Обновляем данные лицензии
                    _, updated_data = license_manager.validate_license(license_key)
                    if updated_data:
                        st.session_state.license_data = updated_data
            
            if can_generate:
                # Создаем новый scheduler
                scheduler = ShiftScheduler()
                
                # Добавляем сотрудников
                for emp_data in employees_data:
                    if emp_data['name'].strip():
                        vacation_days = parse_date_list(emp_data['vacation'])
                        exclusion_days = parse_date_list(emp_data['exclusion'])
                        priority = emp_data.get('priority', 0)
                        scheduler.add_employee(
                            emp_data['name'].strip(),
                            vacation_days,
                            exclusion_days,
                            priority
                        )
                
                # Генерируем расписание
                scheduler.generate_schedule(st.session_state.daily_shifts)
                
                st.session_state.scheduler = scheduler
                st.session_state.schedule_generated = True
                st.success("✅ Расписание сгенерировано!")
                st.rerun()

# Основная область - отображение результатов
if st.session_state.schedule_generated and st.session_state.scheduler:
    scheduler = st.session_state.scheduler
    
    # Вкладки для разных представлений
    tab1, tab2, tab3, tab4 = st.tabs(["📊 Статистика", "📅 Календарь", "✏️ Редактор", "⚠️ Нераспределенные"])
    
    with tab1:
        st.header("Статистика распределения")
        
        # Общая статистика
        col1, col2, col3, col4 = st.columns(4)
        
        total_requested = sum(len(shifts) for shifts in st.session_state.daily_shifts.values())
        
        with col1:
            st.metric("Всего нарядов", total_requested)
        with col2:
            st.metric("Распределено", len(scheduler.assigned_shifts))
        with col3:
            st.metric("Нераспределено", len(scheduler.unassigned_shifts))
        with col4:
            st.metric("Сотрудников", len(scheduler.employees))
        
        st.markdown("---")
        
        # Статистика по сотрудникам
        st.subheader("Нагрузка по сотрудникам")
        
        stats_data = []
        for employee in scheduler.employees:
            stats_data.append({
                'Сотрудник': employee.name,
                'Приоритет': employee.priority,
                'Нарядов': scheduler.employee_stats[employee.id]['shifts_count'],
                'Осталось слотов': scheduler.employee_stats[employee.id]['monthly_slots'],
                'Занято дней': len(scheduler.employee_stats[employee.id]['occupied_days'])
            })
        
        stats_df = pd.DataFrame(stats_data)
        st.dataframe(stats_df, use_container_width=True)
        
        st.markdown("---")
        
        # Визуализация нагрузки
        st.subheader("📈 Визуализация нагрузки")
        
        col1, col2 = st.columns(2)
        
        with col1:
            # Столбчатая диаграмма распределения нарядов
            fig_bar = create_workload_bar_chart(scheduler)
            st.plotly_chart(fig_bar, use_container_width=True)
            
            # График распределения по дням
            fig_daily = create_daily_distribution_chart(scheduler, st.session_state.daily_shifts)
            st.plotly_chart(fig_daily, use_container_width=True)
        
        with col2:
            # Круговая диаграмма использования слотов
            fig_pie = create_slots_pie_chart(scheduler)
            st.plotly_chart(fig_pie, use_container_width=True)
        
        # Временная шкала нарядов
        st.subheader("⏱️ Временная шкала нарядов")
        timeline_fig = create_employee_timeline(scheduler, st.session_state.daily_shifts)
        if timeline_fig:
            st.plotly_chart(timeline_fig, use_container_width=True)
        else:
            st.info("Нет данных для отображения временной шкалы")
    
    with tab2:
        st.header("Календарное распределение")
        
        df = create_calendar_table(scheduler, st.session_state.daily_shifts)
        if df is not None:
            st.dataframe(df, use_container_width=True)
            
            st.info("📝 Обозначения: Х - отпуск, цифра - номер наряда, * - день отдыха после наряда")
            
            # Кнопка экспорта
            st.subheader("📥 Экспорт данных")
            
            # Проверка возможности скачивания
            can_download = st.session_state.license_data.get("can_download", False)
            
            if not can_download:
                st.warning("⚠️ Экспорт файлов недоступен в демо-режиме. Активируйте полную лицензию для доступа к экспорту.")
            else:
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    # Экспорт таблицы распределения
                    csv_buffer = io.StringIO()
                    df.to_csv(csv_buffer, index=False, encoding='utf-8-sig')
                    st.download_button(
                        label="📄 CSV: Распределение",
                        data=csv_buffer.getvalue(),
                        file_name=f"распределение_нарядов_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                        mime="text/csv",
                        use_container_width=True
                    )
                
                with col2:
                    # Экспорт в Excel
                    excel_data = export_to_excel(scheduler, st.session_state.daily_shifts)
                    st.download_button(
                        label="📊 Excel: Полный отчет",
                        data=excel_data,
                        file_name=f"отчет_распределения_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
                        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        use_container_width=True
                    )
                
                with col3:
                    # Экспорт нераспределенных нарядов
                    if scheduler.unassigned_shifts:
                        unassigned_data = []
                        for shift in scheduler.unassigned_shifts:
                            reason = scheduler.analyze_unassigned_reason(shift)
                            unassigned_data.append({
                                'Дата': shift.date.strftime('%d.%m.%Y'),
                                'Тип наряда': shift.type,
                                'Причина': reason
                            })
                        
                        unassigned_df = pd.DataFrame(unassigned_data)
                        csv_buffer2 = io.StringIO()
                        unassigned_df.to_csv(csv_buffer2, index=False, encoding='utf-8-sig')
                        
                        st.download_button(
                            label="⚠️ CSV: Нераспределенные",
                            data=csv_buffer2.getvalue(),
                            file_name=f"нераспределенные_наряды_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                            mime="text/csv",
                            use_container_width=True
                        )
    
    with tab3:
        st.header("✏️ Ручное редактирование распределения")
        
        st.info("В этом разделе вы можете вручную изменить назначения нарядов")
        
        # Получаем список всех нарядов для редактирования
        edit_data = []
        for shift in scheduler.assigned_shifts:
            employee = next((e for e in scheduler.employees if e.id == shift.employee_id), None)
            edit_data.append({
                'Дата': shift.date.strftime('%d.%m.%Y'),
                'Тип наряда': shift.type,
                'Назначен': employee.name if employee else 'Не назначен',
                'shift_obj': shift
            })
        
        if edit_data:
            edit_df = pd.DataFrame(edit_data)
            
            # Отображаем таблицу
            st.dataframe(edit_df[['Дата', 'Тип наряда', 'Назначен']], use_container_width=True)
            
            st.markdown("---")
            st.subheader("Изменить назначение")
            
            col1, col2, col3 = st.columns(3)
            
            with col1:
                # Выбор даты наряда для изменения
                selected_date = st.selectbox(
                    "Выберите дату наряда",
                    options=sorted(list(set([d['Дата'] for d in edit_data]))),
                    key="edit_date"
                )
            
            with col2:
                # Фильтруем наряды по выбранной дате
                shifts_on_date = [d for d in edit_data if d['Дата'] == selected_date]
                selected_shift_idx = st.selectbox(
                    "Выберите наряд",
                    options=range(len(shifts_on_date)),
                    format_func=lambda x: f"Тип {shifts_on_date[x]['Тип наряда']} - {shifts_on_date[x]['Назначен']}",
                    key="edit_shift"
                )
            
            with col3:
                # Выбор нового сотрудника
                employee_names = [e.name for e in scheduler.employees]
                new_employee = st.selectbox(
                    "Новый сотрудник",
                    options=employee_names,
                    key="new_employee"
                )
            
            if st.button("💾 Сохранить изменение", use_container_width=True):
                # Применяем изменение
                shift_to_edit = shifts_on_date[selected_shift_idx]['shift_obj']
                old_employee = next((e for e in scheduler.employees if e.id == shift_to_edit.employee_id), None)
                new_emp = next((e for e in scheduler.employees if e.name == new_employee), None)
                
                if new_emp:
                    # Проверяем доступность нового сотрудника
                    available = scheduler._is_employee_available(new_emp, shift_to_edit.date, shift_to_edit.type)
                    
                    if available:
                        # Обновляем статистику старого сотрудника
                        if old_employee:
                            scheduler.employee_stats[old_employee.id]['shifts_count'] -= 1
                            scheduler.employee_stats[old_employee.id]['monthly_slots'] += 1
                            
                            # Удаляем занятые дни
                            days_to_remove = [shift_to_edit.date]
                            if shift_to_edit.type in [1, 2, 3, 4, 5, 6]:
                                days_to_remove.append(shift_to_edit.date + timedelta(days=1))
                            
                            for day in days_to_remove:
                                if day in scheduler.employee_stats[old_employee.id]['occupied_days']:
                                    scheduler.employee_stats[old_employee.id]['occupied_days'].remove(day)
                        
                        # Назначаем новому сотруднику
                        shift_to_edit.employee_id = new_emp.id
                        scheduler.employee_stats[new_emp.id]['shifts_count'] += 1
                        scheduler.employee_stats[new_emp.id]['monthly_slots'] -= 1
                        
                        # Добавляем занятые дни
                        days_to_add = [shift_to_edit.date]
                        if shift_to_edit.type in [1, 2, 3, 4, 5, 6]:
                            days_to_add.append(shift_to_edit.date + timedelta(days=1))
                        
                        for day in days_to_add:
                            scheduler.employee_stats[new_emp.id]['occupied_days'].add(day)
                        
                        # Обновляем session state
                        st.session_state.scheduler = scheduler
                        st.success(f"✅ Наряд успешно переназначен на {new_employee}")
                        st.rerun()
                    else:
                        st.error(f"❌ Сотрудник {new_employee} недоступен на эту дату (отпуск, превышен лимит или уже занят)")
        else:
            st.info("Нет назначенных нарядов для редактирования")
    
    with tab4:
        st.header("Нераспределенные наряды")
        
        if scheduler.unassigned_shifts:
            st.warning(f"⚠️ Не удалось распределить {len(scheduler.unassigned_shifts)} нарядов")
            
            unassigned_data = []
            for shift in scheduler.unassigned_shifts:
                reason = scheduler.analyze_unassigned_reason(shift)
                unassigned_data.append({
                    'Дата': shift.date.strftime('%d.%m.%Y'),
                    'Тип наряда': shift.type,
                    'Дни': '2 дня (с отдыхом)' if shift.type in [1,2,3,4,5,6] else '8 часов',
                    'Причина': reason
                })
            
            unassigned_df = pd.DataFrame(unassigned_data)
            st.dataframe(unassigned_df, use_container_width=True)
            
            # Анализ причин
            st.subheader("Анализ причин")
            reasons_count = unassigned_df['Причина'].value_counts()
            st.bar_chart(reasons_count)
            
        else:
            st.success("✅ Все наряды успешно распределены!")

else:
    # Приветственное сообщение
    st.info("""
    👋 Добро пожаловать в систему распределения нарядов!
    
    **Как пользоваться:**
    1. Загрузите CSV файл с расписанием в боковой панели
    2. Добавьте сотрудников с указанием отпусков и нежелательных дат
    3. Нажмите кнопку "Сгенерировать расписание"
    4. Просмотрите результаты и экспортируйте в CSV
    
    **Формат входного файла:**
    ```
    дата;наряды
    01.10.2025;1,2,3,4
    02.10.2025;1,2,3
    ```
    
    **Типы нарядов:**
    - Типы 1-6: суточные (с 9:00 до 9:00 следующего дня, следующий день - отдых)
    - Тип 7: 8-часовой (можно заступать на следующий день)
    
    **Ограничения:**
    - Максимум 15 суточных нарядов на сотрудника в месяц
    - Автоматический учет отпусков и предпочтений
    - Равномерное распределение нагрузки
    """)

# Футер
st.markdown("---")
st.caption("Система автоматического распределения нарядов v1.0")
