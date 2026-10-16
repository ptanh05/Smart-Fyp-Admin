# 🚀 HƯỚNG DẪN CHẠY LOCAL 2 DỰ ÁN (SMART FYP MANAGEMENT & SMART FYP ADMIN)

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Admin\source\repos\smart-fyp-management\backend'; Write-Host '--- USER BACKEND (PORT 8000) ---' -ForegroundColor Cyan; python manage.py runserver 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Admin\source\repos\smart-fyp-management\frontend'; Write-Host '--- USER FRONTEND (PORT 3000) ---' -ForegroundColor Green; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Admin\source\repos\Smart-Fyp-Admin\backend'; Write-Host '--- ADMIN BACKEND (PORT 8001) ---' -ForegroundColor Yellow; python manage.py runserver 8001"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Admin\source\repos\Smart-Fyp-Admin\frontend'; Write-Host '--- ADMIN FRONTEND (PORT 5174) ---' -ForegroundColor Magenta; npm run dev"




Hệ thống gồm 2 dự án độc lập kết nối chung cơ sở dữ liệu **Neon PostgreSQL**:
1. **`smart-fyp-management`**: Cổng thông tin Sinh viên, Giảng viên Hướng dẫn & Hội đồng Bảo vệ.
2. **`Smart-Fyp-Admin`**: Cổng Quản trị độc lập dành cho Ban Chủ nhiệm Khoa & Giáo vụ Khoa CNTT UTC.

---

## 🌐 1. Bảng Tổng Hợp Địa Chỉ & Port

| Dịch vụ | Thư mục dự án | Port Local | Địa chỉ truy cập | Ghi chú |
| :--- | :--- | :---: | :--- | :--- |
| **Backend (User Portal)** | `smart-fyp-management\backend` | `8000` | [http://localhost:8000](http://localhost:8000) | Django REST & Channels WebSocket |
| **Frontend (User Portal)** | `smart-fyp-management\frontend` | `3000` | [http://localhost:3000](http://localhost:3000) | React + Vite (Proxy sang 8000) |
| **Backend (Admin Portal)** | `Smart-Fyp-Admin\backend` | `8001` | [http://localhost:8001](http://localhost:8001) | Django REST API chuyên Admin |
| **Frontend (Admin Portal)** | `Smart-Fyp-Admin\frontend` | `5174` | [http://localhost:5174](http://localhost:5174) | React + Vite (Gọi API port 8001) |

---

## ⚡ 2. CÁCH 1: Chạy Tự Động 1 Chạm (Khuyên dùng trên Windows)

Mở 1 cửa sổ **PowerShell** bất kỳ và chạy lệnh sau để tự động mở 4 cửa sổ terminal riêng biệt cho 4 service:

```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Admin\source\repos\smart-fyp-management\backend'; Write-Host '--- USER BACKEND (PORT 8000) ---' -ForegroundColor Cyan; python manage.py runserver 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Admin\source\repos\smart-fyp-management\frontend'; Write-Host '--- USER FRONTEND (PORT 3000) ---' -ForegroundColor Green; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Admin\source\repos\Smart-Fyp-Admin\backend'; Write-Host '--- ADMIN BACKEND (PORT 8001) ---' -ForegroundColor Yellow; python manage.py runserver 8001"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Admin\source\repos\Smart-Fyp-Admin\frontend'; Write-Host '--- ADMIN FRONTEND (PORT 5174) ---' -ForegroundColor Magenta; npm run dev"
```

---

## 🖥️ 3. CÁCH 2: Chạy Thủ Công Từng Terminal

Nếu bạn muốn kiểm soát từng log terminal riêng lẻ:

### 🔹 Cụm 1: Dự án `smart-fyp-management` (User Portal)

#### Terminal 1 — Backend (Port 8000):
```bash
cd c:\Users\Admin\source\repos\smart-fyp-management\backend
python manage.py runserver 8000
```
> *API kiểm tra:* `http://localhost:8000/app/health/` hoặc trang quản trị gốc `http://localhost:8000/admin/`

#### Terminal 2 — Frontend (Port 3000):
```bash
cd c:\Users\Admin\source\repos\smart-fyp-management\frontend
npm run dev
```
> *Truy cập trình duyệt:* [http://localhost:3000](http://localhost:3000)

---

### 🔹 Cụm 2: Dự án `Smart-Fyp-Admin` (Admin Portal)

#### Terminal 3 — Backend Admin (Port 8001):
```bash
cd c:\Users\Admin\source\repos\Smart-Fyp-Admin\backend
python manage.py runserver 8001
```
> *API Backend Admin:* `http://localhost:8001/app/`

#### Terminal 4 — Frontend Admin (Port 5174):
```bash
cd c:\Users\Admin\source\repos\Smart-Fyp-Admin\frontend
npm run dev
```
> *Truy cập trình duyệt:* [http://localhost:5174](http://localhost:5174)

---

## 🔑 4. Danh Sách Tài Khoản Kiểm Thử Nhanh

### 👑 Quản trị viên (Admin Portal - `http://localhost:5174`):
- **Tài khoản**: `admin`
- **Mật khẩu**: `Admin@123456`
- *(Trên giao diện có nút bấm nhanh "1-Click Login")*

### 👨‍🏫 Giảng viên / Hội đồng (User Portal - `http://localhost:3000`):
- **TS. Vũ Bá Thắng (GVHD chính)**: `thangvb@utc.edu.vn` (hoặc `ts_thang`) | Mật khẩu: `Gv@123456`
- **PGS.TS. Đỗ Thị Hà (Chủ tịch HĐ 01)**: `hadt@utc.edu.vn` (hoặc `pgs_ha`) | Mật khẩu: `Gv@123456`
- **Tài khoản test nhanh**: `supervisor1` | Mật khẩu: `supervisor123`

### 🎓 Sinh viên (User Portal - `http://localhost:3000`):
- **SV Nguyễn Văn An (Sẵn sàng bảo vệ)**: `201200001` (hoặc `sv_an`) | Mật khẩu: `Sv@123456`
- **SV Trần Thị Bình (Đang chờ phân công)**: `201200002` (hoặc `sv_binh`) | Mật khẩu: `Sv@123456`
- **SV Lê Hoàng Cường (Nợ tín chỉ / Cần duyệt đặc cách)**: `201200003` (hoặc `sv_cuong`) | Mật khẩu: `Sv@123456`

---

## 🛑 5. Cách Dừng Hệ Thống

- Nhấn `Ctrl + C` tại từng cửa sổ Terminal đang chạy.
- Hoặc chạy nhanh trong PowerShell để dừng toàn bộ:
```powershell
Get-Process python, node -ErrorAction SilentlyContinue | Stop-Process -Force
```


