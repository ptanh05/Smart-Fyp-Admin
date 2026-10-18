# DANH SÁCH TÀI KHOẢN & MẬT KHẨU KIỂM THỬ HỆ THỐNG THESISHUB
> **Hệ thống Quản lý Đồ án Tốt nghiệp Thông minh UTC (Smart-FYP Management)**  
> *Dữ liệu đã được làm sạch và chuẩn hóa 100% trên Database Neon PostgreSQL (Tuân thủ nghiêm ngặt chuẩn Pure UTC Schema 25 Bảng).*

---

## 🌐 1. ĐỊA CHỈ TRUY CẬP HỆ THỐNG

| Cổng thông tin | Địa chỉ URL | Đối tượng sử dụng |
| :--- | :--- | :--- |
| **Cổng Sinh viên & Giảng viên** | [http://localhost:3000](http://localhost:3000) | Sinh viên, Giảng viên Hướng dẫn, Thành viên Hội đồng |
| **Cổng Quản trị Khoa (Admin)** | [http://localhost:5174](http://localhost:5174) | Ban Chủ nhiệm Khoa, Giáo vụ Khoa CNTT UTC |
| **Backend API Client** | [http://localhost:8000](http://localhost:8000) | REST API phục vụ Web Client |
| **Backend API Admin** | [http://localhost:8001](http://localhost:8001) | REST API phục vụ Web Admin |

> **Ghi chú về Đợt Đồ án chính thức**:
> - Mã đợt: `K62_HK1_2026_2027`
> - Tên đợt: **Đợt Đồ án Tốt nghiệp K62 - Học kỳ 1 Năm học 2026-2027**
> - Trạng thái: Đang hoạt động (`is_active = True`), Đã công bố phân công (`is_allocation_published = True`).

---

## 👑 2. TÀI KHOẢN QUẢN TRỊ VIÊN KHOA (ADMIN)

| Tên đăng nhập | Email | Mật khẩu | Quyền hạn & Chức năng kiểm thử |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin@utc.edu.vn` | **`Admin@123456`** | • Quản lý cấu hình đợt làm đồ án K62.<br>• Phân công đề tài & Giảng viên hướng dẫn.<br>• **Duyệt đặc cách (Force Approve)** cho sinh viên nợ tín chỉ.<br>• **Phê duyệt đơn xin bảo lưu** đồ án của sinh viên.<br>• Thành lập Hội đồng bảo vệ & xếp lịch phòng bảo vệ. |

*(Cổng Admin tại `http://localhost:5174` có sẵn nút **"⚡ Điền mẫu test nhanh"** hoặc **"🚀 Đăng nhập ngay (1-Click)"**)*

---

## 👨‍🏫 3. DANH SÁCH GIẢNG VIÊN & HỘI ĐỒNG BẢO VỆ (7 CÁN BỘ THẬT)

| STT | Username | Email cán bộ | Họ và tên | Chức danh / Bộ môn | Mật khẩu | Vai trò kiểm thử |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **1** | **`ts_thang`** | `thangvb@utc.edu.vn` | TS. Vũ Bá Thắng | Trưởng BM CNPM | **`Gv@123456`** | • GVHD chính (hướng dẫn SV An, Hùng, Dũng, Quân).<br>• Giao Task, duyệt Báo cáo tuần, chấm điểm GVHD.<br>• Ủy viên Hội đồng 01. |
| **2** | **`pgs_ha`** | `hadt@utc.edu.vn` | PGS.TS. Đỗ Thị Hà | Trưởng BM HTTT | **`Gv@123456`** | • **Chủ tịch Hội đồng 01** bảo vệ ĐATN.<br>• Chấm điểm bảo vệ trực tiếp (Live Score).<br>• GVHD các sinh viên BM HTTT. |
| **3** | **`ts_nam`** | `namth@utc.edu.vn` | TS. Trần Hoài Nam | Trưởng BM KHMT | **`Gv@123456`** | • **Cán bộ Phản biện** đồ án (chấm điểm phản biện).<br>• Ủy viên Hội đồng 01. |
| **4** | **`ths_linh`** | `linhnt@utc.edu.vn` | ThS. Nguyễn Thùy Linh | Giảng viên BM CNPM | **`Gv@123456`** | • **Thư ký 1 Hội đồng 01**.<br>• GVHD sinh viên Cử nhân. |
| **5** | **`ths_duc`** | `duclm@utc.edu.vn` | ThS. Lê Minh Đức | Giảng viên BM HTTT | **`Gv@123456`** | • **Thư ký 2 Hội đồng 01**.<br>• GVHD sinh viên IoT & HTTT. |
| **6** | **`supervisor1`** | `gvc.nguyen@utc.edu.vn` | GVC.TS. Nguyễn Hướng Dẫn | GV Cao cấp BM CNPM | **`supervisor123`** | • Tài khoản mẫu kiểm thử nhanh form đăng nhập Web. |
| **7** | **`committee1`** | `hd.nguyen@utc.edu.vn` | PGS.TS. Nguyễn Chủ Tịch HĐ | Ban Chấm thi ĐATN | **`committee123`** | • Tài khoản mẫu kiểm thử giao diện Hội đồng chấm thi. |

> **Lưu ý khi đăng nhập Giảng viên/Hội đồng tại `http://localhost:3000`**:
> - Chọn tab **"Giảng viên"** hoặc **"Hội đồng"**.
> - Nhập **Email** (ví dụ `thangvb@utc.edu.vn`) hoặc **Username** (ví dụ `ts_thang`).
> - Có sẵn các nút chip điền nhanh: *TS. Thắng*, *PGS. Hà*, *ThS. Linh*, *supervisor1*.

---

## 🎓 4. DANH SÁCH 20 SINH VIÊN THẬT (10 CỬ NHÂN & 10 KỸ SƯ)

Toàn bộ 20 sinh viên được phân bổ đồng đều theo từng kịch bản kiểm thử quy trình 6 giai đoạn của UTC:

### 4.1. Nhóm 10 Sinh viên Cử nhân (Lớp CNTT1-K62 & CNTT2-K62)

| STT | Mã SV (MSSV) | Username | Họ và tên | Lớp | Mật khẩu | Trạng thái đồ án | Kịch bản kiểm thử tương ứng |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **1** | **`201200001`** | `sv_an` | Nguyễn Văn An | CNTT1-K62 | **`Sv@123456`** | `DEFENSE_READY` *(Đủ ĐK bảo vệ)* | **Đã sẵn sàng bảo vệ**: Có 3 Task tiến độ, có Báo cáo tuần, được xếp Hội đồng 01 Slot 1, có điểm Live Score và điểm tổng kết A (8.9/10). |
| **2** | **`201200002`** | `sv_binh` | Trần Thị Bình | CNTT1-K62 | **`Sv@123456`** | `IN_PROGRESS` *(Đang thực hiện)* | **Đang làm đồ án**: GVHD ThS. Linh, kiểm thử nộp task và báo cáo tuần. |
| **3** | **`201200003`** | `sv_chi` | Lê Khánh Chi | CNTT1-K62 | **`Sv@123456`** | `TOPIC_CONFIRMED` *(Chờ duyệt đề tài)* | **Kiểm thử Admin duyệt đề tài**: Đề tài LLM đang ở trạng thái PENDING, dùng Admin để Duyệt hoặc Yêu cầu sửa. |
| **4** | **`201200004`** | `sv_dung` | Phạm Quốc Dũng | CNTT1-K62 | **`Sv@123456`** | `IN_PROGRESS` *(Đang thực hiện)* | **Đang làm đồ án**: GVHD TS. Thắng, kiểm thử trao đổi và nhận xét tiến độ. |
| **5** | **`201200005`** | `sv_em` | Hoàng Kim Em | CNTT1-K62 | **`Sv@123456`** | `TOPIC_APPROVED` *(Đã duyệt đề tài)* | **Đề tài đã duyệt**: Chuẩn bị nộp đề cương PDF và kế hoạch thực hiện. |
| **6** | **`201200006`** | `sv_giang` | Đinh Trường Giang | CNTT2-K62 | **`Sv@123456`** | `IN_PROGRESS` *(Đang thực hiện)* | **Đang làm đồ án**: GVHD PGS. Hà, kiểm thử nộp báo cáo định kỳ. |
| **7** | **`201200007`** | `sv_hoa` | Ngô Mai Hoa | CNTT2-K62 | **`Sv@123456`** | `IN_PROGRESS` *(Đang thực hiện)* | **Đang làm đồ án**: GVHD ThS. Đức, kiểm thử cập nhật tài liệu kỹ thuật. |
| **8** | **`201200008`** | `sv_khoi` | Đỗ Đăng Khôi | CNTT2-K62 | **`Sv@123456`** | `ALLOCATED` *(Vừa phân công)* | **Giai đoạn 3**: Sinh viên vừa được phân công GVHD, chuẩn bị đăng ký tên đề tài chính thức. |
| **9** | **`201200009`** | `sv_lam` | Bùi Tùng Lâm | CNTT2-K62 | **`Sv@123456`** | `ALLOCATED` *(Vừa phân công)* | **Giai đoạn 3**: Kiểm thử quy trình đề xuất đề tài giữa SV và GVHD. |
| **10** | **`201200102`** | `student2` | Trần Thị Bích | CNTT1-K62 | **`student123`** | `IN_PROGRESS` *(Tài khoản mẫu)* | **Tài khoản mẫu demo**: Click nhanh trên form Login giao diện sinh viên. |

---

### 4.2. Nhóm 10 Sinh viên Kỹ sư (Lớp KSCNTT-K62)

| STT | Mã SV (MSSV) | Username | Họ và tên | Lớp | Mật khẩu | Trạng thái đồ án | Kịch bản kiểm thử tương ứng |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **11** | **`201200011`** | `sv_hung` | Vũ Mạnh Hùng | KSCNTT-K62 | **`Sv@123456`** | `DEFENSE_READY` *(Đủ ĐK bảo vệ)* | **Đồ án Kỹ sư bảo vệ**: Đề tài AI/CV, xếp Hội đồng 01 Slot 2, đã có điểm GVHD (9.2) và Phản biện (8.8). |
| **12** | **`201200012`** | `sv_khanh` | Bùi Nam Khánh | KSCNTT-K62 | **`Sv@123456`** | `IN_PROGRESS` *(Nợ 14 tín chỉ)* | **Kiểm thử Force Approve**: Sinh viên nợ 14 tín chỉ (`NOT_ELIGIBLE`). Dùng Web Admin để bấm nút **"Duyệt đặc cách (Force Approve)"**. |
| **13** | **`201200013`** | `sv_long` | Đỗ Hoàng Long | KSCNTT-K62 | **`Sv@123456`** | `IN_PROGRESS` *(Nợ 12 tín chỉ)* | **Kiểm thử Force Approve**: Sinh viên nợ 12 tín chỉ (`NOT_ELIGIBLE`). Dùng Web Admin để duyệt điều kiện bảo vệ. |
| **14** | **`201200014`** | `sv_minh` | Ngô Nhật Minh | KSCNTT-K62 | **`Sv@123456`** | `IN_PROGRESS` *(Có đơn bảo lưu)* | **Kiểm thử Duyệt Bảo lưu**: Sinh viên đã nộp đơn xin hoãn/bảo lưu đồ án do tai nạn. Dùng Web Admin để Phê duyệt đơn. |
| **15** | **`201200015`** | `sv_ngoc` | Phạm Bảo Ngọc | KSCNTT-K62 | **`Sv@123456`** | `IN_PROGRESS` *(Có đơn bảo lưu)* | **Kiểm thử Duyệt Bảo lưu**: Sinh viên nộp đơn bảo lưu do hoàn cảnh gia đình. Trạng thái đơn `PENDING`. |
| **16** | **`201200016`** | `sv_phuc` | Lê Hoàng Phúc | KSCNTT-K62 | **`Sv@123456`** | `IN_PROGRESS` *(Đang thực hiện)* | **Đang làm đồ án Kỹ sư**: GVHD TS. Nam, đề tài an ninh mạng Zero Trust. |
| **17** | **`201200017`** | `sv_quan` | Trần Minh Quân | KSCNTT-K62 | **`Sv@123456`** | `IN_PROGRESS` *(Đang thực hiện)* | **Đang làm đồ án Kỹ sư**: GVHD TS. Thắng, đề tài hệ thống Cloud Microservices. |
| **18** | **`201200018`** | `sv_son` | Nguyễn Thái Sơn | KSCNTT-K62 | **`Sv@123456`** | `TOPIC_CONFIRMED` *(Chờ duyệt đề tài)* | **Đề tài Kỹ sư chờ Khoa duyệt**: Đề tài hệ thống AI IDS phát hiện xâm nhập mạng. |
| **19** | **`201200019`** | `sv_thao` | Vũ Phương Thảo | KSCNTT-K62 | **`Sv@123456`** | `TOPIC_APPROVED` *(Đã duyệt đề tài)* | **Đề tài Kỹ sư đã duyệt**: Chuẩn bị báo cáo đề cương chi tiết. |
| **20** | **`201200103`** | `student3` | Lê Văn Cường | KSCNTT-K62 | **`student123`** | `IN_PROGRESS` *(Tài khoản mẫu)* | **Tài khoản mẫu demo Kỹ sư**: Có sẵn nút chip điền nhanh trên màn hình đăng nhập. |

---

## ⚡ 5. HƯỚNG DẪN ĐĂNG NHẬP NHANH BẰNG NÚT BẤM (1-CLICK)

Trên giao diện web đã tích hợp sẵn tính năng tự động điền để kiểm thử viên không cần gõ bàn phím:

1. **Trên trang Quản trị Admin (`http://localhost:5174`)**:
   - Nhìn vào hộp xanh **"⚡ ĐIỀN MẪU TEST NHANH"**.
   - Bấm nút **"🚀 Đăng nhập ngay (1-Click)"** -> Hệ thống tự điền `admin` / `Admin@123456` và chuyển thẳng vào Dashboard.

2. **Trên trang Sinh viên / Giảng viên (`http://localhost:3000`)**:
   - Chọn vai trò mong muốn (**Sinh viên**, **Giảng viên**, **Hội đồng**).
   - Nhìn vào danh sách nút mẫu phía trên form đăng nhập:
     - 🎓 **An (201200001)**: Sinh viên Cử nhân đã đủ điều kiện bảo vệ, có điểm hội đồng.
     - 🎓 **Hùng (201200011)**: Sinh viên Kỹ sư đủ điều kiện bảo vệ.
     - ⚠️ **Khánh (201200012)**: Sinh viên nợ 14 tín chỉ (dùng test Force Approve).
     - 🎓 **201200102**: Sinh viên mẫu demo (`student123`).
     - 👨‍🏫 **TS. Thắng**: Giảng viên hướng dẫn chính (`ts_thang`).
     - 🏛️ **Chủ tịch HĐ**: PGS.TS. Đỗ Thị Hà (`pgs_ha`).
   - Bấm vào nút bất kỳ, thông tin đăng nhập sẽ tự động điền đầy đủ và chính xác vào form!
