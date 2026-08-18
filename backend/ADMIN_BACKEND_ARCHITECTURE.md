# SMART FYP MANAGEMENT SYSTEM — ADMIN BACKEND ARCHITECTURE

**Institution**: University of Transport and Communications (UTC)  
**Architecture**: 2 Frontends + 2 Backends + 1 Shared Neon PostgreSQL Database  
**Audit Date**: August 18, 2026  

---

## 1. Multi-Tier System Topology Diagram

```mermaid
graph TD
    subgraph DatabaseLayer ["Database Layer (One Shared Instance)"]
        NeonDB[("Neon PostgreSQL Production Database\n(app_customuser, app_auditlog, app_group, app_document)")]
    end

    subgraph BackendLayer ["Backend Layer (2 Independent Django REST Services)"]
        MainBE["Main Backend Django/DRF\n(smart-fyp-management/backend)\n[Port 8000]"]
        AdminBE["Admin Backend Django/DRF\n(smart-fyp-admin-backend)\n[Port 8001]"]
    end

    subgraph FrontendLayer ["Frontend Layer (2 Independent SPAs)"]
        MainFE["Main Web SPA\n(Student, Supervisor, Committee, External)\n[Port 3000/5173]"]
        AdminFE["Admin Web SPA\n(smart-fyp-admin)\n[Port 5174]"]
    end

    NeonDB <-->|DATABASE_URL| MainBE
    NeonDB <-->|DATABASE_URL| AdminBE

    MainBE <-->|REST / WebSockets| MainFE
    AdminBE <-->|REST API| AdminFE
```

---

## 2. Component Separation & Responsibilities

| Component | Repository Path | Tech Stack | Port / Target | Responsibilities |
| :--- | :--- | :--- | :---: | :--- |
| **Shared Database** | Cloud Host (Neon) | PostgreSQL | `5432` | Single Source of Truth for Users, Groups, Documents, Audit Logs |
| **Main Backend** | `smart-fyp-management/backend` | Django 5 DRF + Channels | `8000` | Student, Supervisor, Committee, External APIs & WebSockets |
| **Main Frontend** | `smart-fyp-management/frontend` | React 18 + Vite | `3000` | Primary Portal for Academic Users |
| **Admin Backend** | `smart-fyp-admin-backend` | Django 5 DRF | `8001` | Admin Auth, User Management, Security Center, Audit Logs |
| **Admin Frontend** | `smart-fyp-admin` | React 18 + Vite | `5174` | Enterprise Administrator Management Portal |
