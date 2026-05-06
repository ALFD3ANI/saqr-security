# 🦅 Saqr Security — أمان الصقر

> **منصة SaaS للأمن السيبراني مدعومة بالذكاء الاصطناعي**  
> *Cybersecurity SaaS Platform powered by AI*

---

## 🇸🇦 عربي

### ما هي المنصة؟
Saqr Security منصة متكاملة للأمن السيبراني تساعد الشركات السعودية والخليجية على:
- فحص المواقع والتطبيقات عن الثغرات
- الامتثال للمعايير السعودية (NCA ECC، SAMA CSF، PDPL)
- إصلاح الثغرات بمساعدة الذكاء الاصطناعي

### متطلبات التشغيل
- Docker Desktop
- Git

### كيف تشغّل المشروع؟

```bash
# 1. استنسخ المشروع
git clone <repo-url>
cd saqr-security

# 2. انسخ ملف البيئة
cp .env.example .env
# عدّل .env وأضف مفاتيحك

# 3. شغّل كل شي بأمر واحد
docker-compose up --build

# 4. افتح المتصفح
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

---

## 🇬🇧 English

### What is it?
Saqr Security is a complete cybersecurity SaaS platform helping Saudi and Gulf companies:
- Scan websites and applications for vulnerabilities
- Comply with Saudi standards (NCA ECC, SAMA CSF, PDPL)
- Fix vulnerabilities with AI assistance

### Requirements
- Docker Desktop
- Git

### Quick Start

```bash
git clone <repo-url>
cd saqr-security
cp .env.example .env
# Edit .env with your keys
docker-compose up --build
```

**URLs:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## 📁 Project Structure

```
saqr-security/
├── backend/          # FastAPI Python Backend
│   ├── app/
│   │   ├── api/      # API endpoints
│   │   ├── core/     # Config, security, AI manager
│   │   ├── models/   # Database models
│   │   └── main.py   # App entry point
│   └── requirements.txt
├── frontend/         # React + TypeScript Frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── i18n/     # Arabic + English translations
│   │   └── stores/   # Zustand state
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🔒 Security Notes
- Never commit `.env` to git
- Change all default secrets before production
- Enable 2FA for admin account in production

---

## 📞 Support
- Email: support@saqr-security.com
- Arabic: دعم كامل باللغة العربية
