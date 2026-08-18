# SMART FYP MANAGEMENT SYSTEM — SHARED DB MAPPING SPECIFICATION

| Shared Database Table | Main Backend Model | Admin Backend Model | Read / Write Operations |
| :--- | :--- | :--- | :--- |
| `app_customuser` | `CustomUser` | `CustomUser` | **READ/WRITE**: Query users, update `is_active`, change `user_type` |
| `app_auditlog` | `AuditLog` | `AuditLog` | **READ/WRITE**: List logs, query stats, record admin action events |
| `app_student` | `Student` | Read-only ORM query | **READ**: Compute user count metrics |
| `app_supervisor` | `Supervisor` | Read-only ORM query | **READ**: Compute supervisor metrics |
| `app_group` | `Group` | Read-only ORM query | **READ**: Compute group metrics |
