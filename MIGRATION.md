# MongoDB Migration Guide (Furniture_store)

## 1) Як підключити проєкт до існуючого Mongo cluster

1. Візьміть URI вашого існуючого cluster (Mongo Atlas або self-hosted).
2. Створіть `backend/.env` на основі `backend/.env.example`.
3. Заповніть:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER_URL/?retryWrites=true&w=majority
DB_NAME=furniture_store_db
JWT_SECRET=your_strong_secret
CORS_ORIGINS=http://localhost:3000,http://localhost:8081
PORT=8000
```

4. Запустіть backend і перевірте `GET /api/health`.

## 2) Чому потрібна окрема база для Furniture_store

Окрема база в тому ж cluster (`furniture_store_db`) дає:
- ізоляцію даних від інших проєктів;
- безпечнішу міграцію/rollback;
- окремі backup/моніторинг/доступи;
- відсутність конфліктів у колекціях і схемах.

## 3) Як створити окремого Mongo user для цього проєкту

Рекомендовано створити окремого користувача з правами **тільки на `furniture_store_db`**:
- Atlas: Database Access → Add New Database User.
- Роль: `readWrite` на базу `furniture_store_db`.
- Використайте цього user в `MONGODB_URI`.

## 4) Які env змінні треба заповнити

Обов'язково:
- `MONGODB_URI`
- `JWT_SECRET`

Рекомендовано:
- `DB_NAME` (залишити `furniture_store_db`)
- `CORS_ORIGINS`
- `PORT`
- `ENVIRONMENT`

## 5) Як перевірити, що backend підключився до правильної бази

1. У `backend/.env` встановіть `DB_NAME=furniture_store_db`.
2. Запустіть backend.
3. Створіть будь-який запис через API (наприклад, користувача або категорію).
4. У MongoDB Atlas/Data Explorer перевірте, що нові колекції/документи з'явились саме в `furniture_store_db`.

## 6) Як переконатися, що колекції створюються саме в furniture_store_db

- Не створюйте колекції вручну.
- Зробіть перший `POST` у API, який пише дані.
- Mongo створить колекцію автоматично у базі з `DB_NAME`.
- Переконайтесь, що в інших базах нові колекції не з'явились.

## 7) Як перевірити API після міграції

1. Healthcheck:
   - `GET /api/health`
2. Auth:
   - login / отримання JWT
3. CRUD:
   - створення/читання категорій, товарів, замовлень
4. Перевірка в Mongo:
   - документи реально з'являються в `furniture_store_db`
