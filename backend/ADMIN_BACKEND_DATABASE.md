# SMART FYP MANAGEMENT SYSTEM — SHARED DATABASE STRATEGY

**Institution**: University of Transport and Communications (UTC)  
**Database**: Neon PostgreSQL Production Database  
**Audit Date**: August 18, 2026  

---

## 1. Single Database Authority Principles

To prevent schema conflicts, migration deadlocks, or table duplication between `smart-fyp-management/backend` and `smart-fyp-admin-backend`:

1. **Sole Migration Authority**:
   - `smart-fyp-management/backend` is the **ONLY** service authorized to execute Django migrations (`makemigrations`, `migrate`).
   - `smart-fyp-admin-backend` maps to existing tables via `db_table = "app_customuser"` and `db_table = "app_auditlog"`.
2. **Zero Schema Duplication**:
   - `smart-fyp-admin-backend` does not create new tables or duplicate schemas.
   - All user account state changes (`is_active`, `user_type`) and audit logs persist instantly to the shared Neon PostgreSQL instance.
3. **Database Connection Configuration**:
   - Both backends read their connection credentials securely from the environment variable `DATABASE_URL`.
   - Database credentials are **NEVER** exposed to client-side JavaScript or committed to source control.
