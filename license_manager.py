import sqlite3
import hashlib
import uuid
from datetime import datetime, timedelta
import os
import secrets

class LicenseManager:
    def __init__(self, db_path="licenses.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Инициализация базы данных лицензий"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS licenses (
                id TEXT PRIMARY KEY,
                license_key_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                license_type TEXT NOT NULL,
                created_date TEXT NOT NULL,
                expiry_date TEXT,
                monthly_generations INTEGER DEFAULT 10,
                used_generations INTEGER DEFAULT 0,
                last_reset_date TEXT,
                is_active BOOLEAN NOT NULL DEFAULT 1
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS demo_sessions (
                session_id TEXT PRIMARY KEY,
                start_time TEXT NOT NULL,
                expiry_time TEXT NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT 1
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS usage_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                license_key TEXT,
                session_id TEXT,
                action TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
        """)
        
        conn.commit()
        conn.close()
    
    def _hash_key(self, license_key, salt):
        """Хэширование ключа с солью"""
        return hashlib.pbkdf2_hmac('sha256', license_key.encode(), salt.encode(), 100000).hex()
    
    def generate_license_key(self, license_type="full", months_valid=12):
        """Генерация нового лицензионного ключа"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        license_id = str(uuid.uuid4())
        license_key = hashlib.sha256(f"{license_id}{datetime.now().isoformat()}".encode()).hexdigest()[:24].upper()
        
        formatted_key = f"{license_key[:6]}-{license_key[6:12]}-{license_key[12:18]}-{license_key[18:24]}"
        
        # Генерируем соль и хэшируем ключ
        salt = secrets.token_hex(16)
        key_hash = self._hash_key(formatted_key, salt)
        
        created_date = datetime.now().isoformat()
        expiry_date = (datetime.now() + timedelta(days=months_valid*30)).isoformat()
        last_reset_date = datetime.now().isoformat()
        
        cursor.execute("""
            INSERT INTO licenses 
            (id, license_key_hash, salt, license_type, created_date, expiry_date, last_reset_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (license_id, key_hash, salt, license_type, created_date, expiry_date, last_reset_date))
        
        conn.commit()
        conn.close()
        
        return formatted_key
    
    def start_demo_session(self):
        """Начать демо-сессию на 3 часа"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        session_id = str(uuid.uuid4())
        start_time = datetime.now()
        expiry_time = start_time + timedelta(hours=3)
        
        cursor.execute("""
            INSERT INTO demo_sessions 
            (session_id, start_time, expiry_time)
            VALUES (?, ?, ?)
        """, (session_id, start_time.isoformat(), expiry_time.isoformat()))
        
        cursor.execute("""
            INSERT INTO usage_logs 
            (session_id, action, timestamp)
            VALUES (?, ?, ?)
        """, (session_id, "demo_started", datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
        
        return session_id, expiry_time
    
    def validate_demo_session(self, session_id):
        """Проверка валидности демо-сессии"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM demo_sessions 
            WHERE session_id = ? AND is_active = 1
        """, (session_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            return False, "Демо-сессия не найдена"
        
        expiry_time = datetime.fromisoformat(result[2])
        time_remaining = expiry_time - datetime.now()
        
        if time_remaining.total_seconds() <= 0:
            return False, "Демо-период истек (3 часа)"
        
        hours = int(time_remaining.total_seconds() // 3600)
        minutes = int((time_remaining.total_seconds() % 3600) // 60)
        
        return True, {
            "type": "demo",
            "time_remaining": f"{hours}ч {minutes}мин",
            "can_download": False
        }
    
    def validate_license(self, license_key):
        """Проверка лицензионного ключа"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Получаем все активные лицензии
        cursor.execute("""
            SELECT * FROM licenses 
            WHERE is_active = 1
        """)
        
        all_licenses = cursor.fetchall()
        
        # Ищем лицензию с подходящим хэшем
        matching_license = None
        for lic in all_licenses:
            stored_hash = lic[1]  # license_key_hash
            salt = lic[2]  # salt
            
            # Вычисляем хэш введенного ключа
            input_hash = self._hash_key(license_key, salt)
            
            if input_hash == stored_hash:
                matching_license = lic
                break
        
        if not matching_license:
            conn.close()
            return False, "Неверный лицензионный ключ"
        
        # Проверяем срок действия
        if matching_license[5]:  # expiry_date
            expiry_date = datetime.fromisoformat(matching_license[5])
            if datetime.now() > expiry_date:
                conn.close()
                return False, "Срок действия лицензии истек"
        
        # Проверяем сброс счетчика в новом месяце
        last_reset = datetime.fromisoformat(matching_license[8])  # last_reset_date
        current_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        license_id = matching_license[0]
        
        if last_reset < current_month:
            cursor.execute("""
                UPDATE licenses 
                SET used_generations = 0, last_reset_date = ?
                WHERE id = ?
            """, (datetime.now().isoformat(), license_id))
            conn.commit()
            used_generations = 0
        else:
            used_generations = matching_license[7]  # used_generations
        
        monthly_limit = matching_license[6]  # monthly_generations
        
        conn.close()
        
        return True, {
            "type": "full",
            "license_key": license_key,
            "license_id": license_id,
            "monthly_limit": monthly_limit,
            "used_generations": used_generations,
            "remaining_generations": monthly_limit - used_generations,
            "can_download": True
        }
    
    def use_generation(self, license_key):
        """Использовать одну генерацию"""
        # Сначала валидируем лицензию чтобы получить license_id
        is_valid, result = self.validate_license(license_key)
        
        if not is_valid:
            return False, result
        
        license_id = result["license_id"]
        monthly_limit = result["monthly_limit"]
        used = result["used_generations"]
        
        if used >= monthly_limit:
            return False, f"Достигнут лимит генераций ({monthly_limit}/месяц)"
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE licenses 
            SET used_generations = used_generations + 1
            WHERE id = ?
        """, (license_id,))
        
        cursor.execute("""
            INSERT INTO usage_logs 
            (license_key, action, timestamp)
            VALUES (?, ?, ?)
        """, (license_id[:8], "generation_used", datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
        
        return True, f"Использовано генераций: {used + 1}/{monthly_limit}"
    
    def get_all_licenses(self):
        """Получить все лицензии (для администратора)"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM licenses WHERE is_active = 1")
        results = cursor.fetchall()
        
        conn.close()
        
        licenses = []
        for row in results:
            licenses.append({
                "id": row[0],
                "key_hash": row[1][:16] + "...",  # Показываем только начало хэша для идентификации
                "type": row[3],  # license_type
                "created": row[4],  # created_date
                "expiry": row[5],  # expiry_date
                "limit": row[6],  # monthly_generations
                "used": row[7]  # used_generations
            })
        
        return licenses
