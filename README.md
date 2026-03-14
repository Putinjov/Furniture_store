# Furniture Store

Furniture Store — full-stack застосунок для керування магазином меблів: користувачі, товари, замовлення, доставки, платежі.

## Структура репозиторію

- `backend/` — FastAPI + MongoDB (Motor)
- `frontend/` — Expo + React Native
- `tests/` — службовий пакет для тестів

## Технологічний стек

### Backend
- FastAPI
- Motor/PyMongo для MongoDB
- JWT auth (`pyjwt`)

### Frontend
- Expo
- React Native
- Zustand
- Axios

## Налаштування змінних середовища

### Backend (`backend/.env`)
Скопіюйте `backend/.env.example` у `backend/.env` і заповніть:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER_URL/?retryWrites=true&w=majority
DB_NAME=furniture_store_db
JWT_SECRET=change_me
CORS_ORIGINS=http://localhost:3000,http://localhost:8081
ENVIRONMENT=development
PORT=8000
```

> `MONGODB_URI` обов'язковий. `DB_NAME` за замовчуванням: `furniture_store_db`.

### Frontend (`frontend/.env`)

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

## Локальний запуск

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

API буде доступний на `http://localhost:8000`, документація: `http://localhost:8000/docs`.

### Імпорт товарів з Excel/CSV

Додано ендпоінт для масового імпорту товарів:

- `POST /api/products/import` (multipart/form-data, поле файлу: `file`)
- Підтримувані формати: `.csv`, `.xls`, `.xlsx`
- Потрібна роль: `owner` або `manager`

Підтримувані колонки у файлі:

- обов'язкові: `name`, `category_id` **або** `category_name` / `category`
- опціональні: `description`, `price`, `cost`, `stock_quantity`, `status`, `low_stock_threshold`

Нотатки:

- якщо передано `category_name` і категорія не знайдена — вона буде створена автоматично;
- некоректні рядки пропускаються, а API повертає список помилок по рядках.

### 2) Frontend

```bash
cd frontend
npm install
npm run start
```

## Підключення до існуючого MongoDB cluster

Проєкт використовує **той самий cluster**, але **окрему базу** через `DB_NAME` (рекомендовано `furniture_store_db`).

- URI кластера задається лише через `MONGODB_URI`
- База для цього проєкту задається через `DB_NAME`
- Колекції створюються автоматично при першому записі

Детально див. `MIGRATION.md`.

## Деплой (коротко)

1. На сервері/платформі задати env для backend: `MONGODB_URI`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS`, `PORT`.
2. Запускати backend через `uvicorn server:app --host 0.0.0.0 --port $PORT`.
3. Для frontend задати `EXPO_PUBLIC_BACKEND_URL` на публічний URL backend.
4. Перевірити `GET /api/health` і базові авторизовані ендпоінти.
