from pathlib import Path

from fastapi import FastAPI, Form, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI(title="Пошивочный цех «Стежок»")

# Абсолютные пути от расположения этого файла — на Vercel Serverless
# рабочая директория процесса не совпадает с корнем проекта.
BASE_DIR = Path(__file__).resolve().parent

# Статика (css, изображения) и HTML-шаблоны
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


@app.get("/")
async def index(request: Request):
    """Главная страница-лендинг."""
    return templates.TemplateResponse(request, "index.html")


@app.get("/privacy")
async def privacy(request: Request):
    """Политика конфиденциальности."""
    return templates.TemplateResponse(request, "privacy.html")


@app.post("/order")
async def order(name: str = Form(...), phone: str = Form(...)):
    """
    Приём заявки с формы обратной связи (Имя, Телефон).
    Обработка (сохранение в БД, отправка в CRM/telegram и т.д.)
    пока не реализована — оставлено пустым по требованию.
    """
    # TODO: обработать заявку (name, phone)
    pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
