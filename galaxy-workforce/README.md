# Galaxy Workforce

## Run
    cd backend && python -m venv .venv && .venv\Scripts\activate
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

    cd frontend && python -m http.server 5173   # open http://localhost:5173
