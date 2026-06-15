# Inquiry Management System

A modern web application for managing product inquiries, vendor matching, and quotation processing.

## Project Structure

```
├── frontend/          # React + Vite frontend application
├── backend/           # FastAPI Python backend
└── README.md
```

## Frontend

React-based web application built with Vite.

**Location:** `frontend/`

**Tech Stack:**
- React 18.3
- Vite 5.4
- React Router
- Recharts for analytics

**Setup:**
```bash
cd frontend
npm install
npm run dev      # Start development server (port 3000)
npm test         # Run tests
npm run build    # Build for production
```

## Backend

FastAPI Python application with SQLAlchemy ORM.

**Location:** `backend/`

**Tech Stack:**
- FastAPI
- SQLAlchemy 2.0
- Pydantic
- JWT Authentication
- SQLite (development) / PostgreSQL (production)

**Setup:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload  # Start server (port 8000)
pytest                      # Run tests
```

## Quick Start

1. **Start Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

2. **Start Frontend (in another terminal):**
```bash
cd frontend
npm install
npm run dev
```

3. **Access Application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Features

- ✅ User authentication with JWT
- ✅ Inquiry management and processing
- ✅ Vendor master and product catalog
- ✅ Automated vendor matching
- ✅ Price quotation system
- ✅ Work queue management
- ✅ Analytics dashboard
- ✅ Response tracking
- ✅ Admin user management

## Testing

**Frontend:**
```bash
cd frontend
npm test              # Run all tests
npm test -- --ui     # Run with UI
```

**Backend:**
```bash
cd backend
pytest                # Run all tests
pytest -v             # Verbose output
```

## Database

The system uses:
- **Development:** SQLite (auto-created)
- **Production:** PostgreSQL recommended

## License

MIT

---

**Last Updated:** June 10, 2026
