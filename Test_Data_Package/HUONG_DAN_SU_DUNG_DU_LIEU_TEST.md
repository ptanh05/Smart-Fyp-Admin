# CẨM NANG HƯỚNG DẪN SỬ DỤNG BỘ DỮ LIỆU KIỂM THỬ THESISHUB (UTC)

Thư mục này chứa đầy đủ tất cả các dữ liệu mẫu, file Excel import, file PDF hồ sơ và bảng kê tài khoản để bạn kiểm thử trực tiếp trên giao diện Web Client và Web Admin.

---

## I. DANH MỤC CÁC TẬP TIN TRONG FOLDER

| Tên tập tin | Định dạng | Mục đích sử dụng trên Web |
| :--- | :---: | :--- |
| **`01_Import_Sinh_Vien_K62_Chuan.xlsx`** | Excel (`.xlsx`) | **Bước 2**: Import danh sách sinh viên chuẩn UTC. Hệ thống tự động phân loại hệ **Kỹ sư** và **Cử nhân**, tự tạo tài khoản người dùng và liên kết lớp sinh hoạt. |
| **`02_Import_Sinh_Vien_Loi_Test_Validation.xlsx`** | Excel (`.xlsx`) | **Bước 2 (Kiểm thử lỗi)**: Cố tình chứa lỗi (trống MSSV, sai hệ đào tạo, sai email) để test tính năng bắt lỗi chi tiết từng dòng của hệ thống. |
| **`03_Import_Bang_Diem_Hoc_Vu_Xet_Dieu_Kien.xlsx`** | Excel (`.xlsx`) | **Bước 9**: Import điểm tích lũy học vụ từ Giáo vụ. Có các ca sinh viên đạt điều kiện ($Nợ < 10$ tín) và ca không đạt ($Nợ \ge 10$ tín) để test nút **Force Approve (Đặc cách)**. |
| **`04_Import_Bang_Diem_Loi_Test_Validation.xlsx`** | Excel (`.xlsx`) | **Bước 9 (Kiểm thử lỗi)**: Cố tình chứa điểm CPA $> 4.0$, MSSV không tồn tại để kiểm thử thông báo từ chối của web. |
| **`05_De_Cuong_Do_An_Mau_Co_Chu_Ky.pdf`** | PDF (`.pdf`) | **Bước 8**: File đề cương đồ án mẫu có chữ ký để sinh viên test chức năng **Nộp đề cương đã ký** (Upload Signed Outline). |
| **`06_Bao_Cao_Tien_Do_Tuan_ERD.pdf`** | PDF (`.pdf`) | **Bước 10**: File báo cáo task / deliverable để sinh viên test chức năng **Nộp sản phẩm tiến độ** cho GVHD review. |
| **`07_Don_Xin_Bao_Luu_Do_An_Tot_Nghiep.pdf`** | PDF (`.pdf`) | **Bước 11**: File đơn xin bảo lưu có chữ ký để sinh viên test chức năng **Gửi yêu cầu bảo lưu đồ án** (Deferral Request). |
| **`08_Tep_Gia_Mao_Kiem_Thu_Bao_Mat.exe`** | Binary (`.exe`) | **Bước 8 (Bảo mật)**: File thực thi giả mạo để test cơ chế an ninh chặn upload file độc hại của hệ thống. |
| **`09_Danh_Sach_Tai_Khoan_Dang_Nhap_Test.xlsx`** | Excel (`.xlsx`) | Bảng tổng hợp tất cả tài khoản test gồm vai trò, username, email, mật khẩu và kịch bản tương ứng. |

---

## II. DANH SÁCH TÀI KHOẢN ĐĂNG NHẬP SẴN SÀNG

| Vai trò | Username | Email | Mật khẩu | Kịch bản kiểm thử |
| :--- | :--- | :--- | :--- | :--- |
| **Admin / Ban Chủ Nhiệm Khoa** | `admin` | `admin@utc.edu.vn` | **`Admin@123456`** | Quản trị đợt, Import file, Phân công, Duyệt đề tài, Force Approve, Duyệt bảo lưu |
| **GVHD (Tiến sĩ - Hệ số 1.2)** | `ts_thang` | `thangvb@utc.edu.vn` | **`Gv@123456`** | Duyệt đề tài, Giao task, Chấm bài nộp, Xác nhận đủ ĐK bảo vệ |
| **GVHD (PGS.TS - Hệ số 1.5)** | `pgs_ha` | `hadt@utc.edu.vn` | **`Gv@123456`** | Hướng dẫn Kỹ sư/Cử nhân, Chủ tịch Hội đồng chấm bảo vệ |
| **GVHD (Thạc sĩ - Hệ số 1.0)** | `ths_linh` | `linhnt@utc.edu.vn` | **`Gv@123456`** | Hướng dẫn Cử nhân (Hệ thống chặn nếu SV Kỹ sư chọn làm GVHD) |
| **Sinh viên Cử nhân** | `sv_an` | `an.nv@utc.edu.vn` | **`Sv@123456`** | Đăng ký NV1-NV3, Nộp đề cương PDF, Nộp task, Bảo vệ |
| **Sinh viên Kỹ sư** | `sv_hung` | `hung.vm@utc.edu.vn` | **`Sv@123456`** | Đăng ký GV Tiến sĩ (thành công), Làm đồ án Kỹ sư |
| **Sinh viên Kỹ sư (Bảo lưu)** | `sv_khanh` | `khanh.bn@utc.edu.vn` | **`Sv@123456`** | Test chức năng Nộp đơn xin bảo lưu đồ án |

---

## III. HƯỚNG DẪN TEST TỪNG BƯỚC THEO SƠ ĐỒ LUỒNG TRÊN GIAO DIỆN WEB

### 1. Bước 1 & 2: Tạo đợt & Import danh sách sinh viên
1. Mở trình duyệt truy cập Web Admin: **`http://localhost:5174`**
2. Đăng nhập tài khoản Admin: `admin` / `Admin@123456`.
3. Vào menu **Đợt đồ án** $ightarrow$ Bấm **Tạo đợt mới**.
4. Vào menu **Quản lý Sinh viên** $ightarrow$ Bấm nút **Import Danh Sách**.
5. Kéo thả file **`01_Import_Sinh_Vien_K62_Chuan.xlsx`** vào khu vực upload $ightarrow$ Bấm **Xác nhận Import**.
   - *Kết quả*: Hệ thống thông báo import thành công 10 sinh viên, tự động phân loại đúng cột Kỹ sư / Cử nhân.
6. Thử kéo thả file **`02_Import_Sinh_Vien_Loi_Test_Validation.xlsx`**:
   - *Kết quả*: Hệ thống báo lỗi chi tiết dòng nào thiếu MSSV, dòng nào sai hệ đào tạo, dòng nào sai email.

### 2. Bước 3 & 4: Sinh viên khảo sát & Ràng buộc học vị GV
1. Mở tab trình duyệt mới truy cập Web Client: **`http://localhost:3000`**
2. Đăng nhập tài khoản sinh viên Kỹ sư: `sv_hung` / `Sv@123456`.
3. Vào trang **Đăng ký nguyện vọng & Khảo sát**:
   - Nếu chọn GVHD là `ThS. Nguyễn Thùy Linh` $ightarrow$ Hệ thống cảnh báo/chặn: *Sinh viên hệ Kỹ sư yêu cầu GVHD có học vị tối thiểu Tiến sĩ*.
   - Đổi lại chọn GVHD là `TS. Vũ Bá Thắng` (NV1), `PGS.TS. Đỗ Thị Hà` (NV2) $ightarrow$ Đăng ký thành công.

### 3. Bước 5 & 6: Chạy thuật toán phân công & Khoa chốt công bố
1. Quay lại trang Web Admin (`http://localhost:5174`).
2. Vào menu **Phân công GVHD** $ightarrow$ Bấm **Chạy thuật toán tối ưu MCMF**.
3. Xem danh sách phân công đề xuất:
   - Thử tính năng **Override (Can thiệp thủ công)** để gán đổi giảng viên nếu muốn.
   - Bấm **Chốt phân công & Công bố đợt đồ án**.

### 4. Bước 7 & 8: Xác định đề tài & Nộp đề cương PDF
1. Đăng nhập tài khoản GVHD `ts_thang` / `Gv@123456` trên Web Client.
2. Vào danh sách đồ án $ightarrow$ Bấm **Xác nhận đề tài** cho sinh viên.
3. Đăng nhập Admin: Vào **Duyệt đề tài**:
   - Nếu bấm **Yêu cầu sửa / Từ chối** mà để trống lý do $ightarrow$ Web báo lỗi bắt buộc nhập lý do.
   - Nhập lý do từ chối $ightarrow$ Trạng thái chuyển yêu cầu sửa.
   - Sau đó bấm **Phê duyệt đề tài** (Approved).
4. Đăng nhập sinh viên `sv_an`:
   - Bấm **Tải đề cương đồ án PDF** về máy.
   - Tại mục nộp đề cương đã ký: Chọn file **`05_De_Cuong_Do_An_Mau_Co_Chu_Ky.pdf`** và bấm **Tải lên**.
   - Thử chọn file **`08_Tep_Gia_Mao_Kiem_Thu_Bao_Mat.exe`** $ightarrow$ Hệ thống báo lỗi từ chối file không đúng định dạng PDF.

### 5. Bước 9: Xét điều kiện học vụ & Force Approve
1. Trên Web Admin, vào menu **Xét điều kiện học vụ** (Academic Clearance).
2. Bấm **Import Bảng Điểm** $ightarrow$ Chọn file **`03_Import_Bang_Diem_Hoc_Vu_Xet_Dieu_Kien.xlsx`**.
3. Quan sát kết quả:
   - Sinh viên `sv_an` nợ 0 tín $ightarrow$ Cờ trạng thái hiển thị **Đủ điều kiện**.
   - Sinh viên `sv_khanh` nợ 14 tín $ightarrow$ Cờ trạng thái hiển thị **Không đủ điều kiện** (Cảnh báo đỏ).
   - Tại dòng của sinh viên `sv_khanh`, bấm nút **Force Approve (Đặc cách)** $ightarrow$ Nhập lý do đặc cách $ightarrow$ Đồ án được phép tiếp tục làm.

### 6. Bước 10: Quản lý Task & Đánh giá kết quả
1. Đăng nhập GVHD `ts_thang`: Vào mục **Quản lý Task** $ightarrow$ Tạo task *"Thiết kế CSDL & ERD"* kèm hạn nộp.
2. Đăng nhập SV `sv_an`: Vào mục Task $ightarrow$ Bấm **Nộp sản phẩm** $ightarrow$ Upload file **`06_Bao_Cao_Tien_Do_Tuan_ERD.pdf`**.
3. Đăng nhập GVHD `ts_thang`: Xem bài nộp $ightarrow$ Đánh giá **Yêu cầu sửa** $ightarrow$ SV nộp lại $ightarrow$ GV duyệt **Đạt (Accepted)**.

### 7. Bước 11: Nhánh Sinh viên làm Đơn xin bảo lưu
1. Đăng nhập sinh viên `sv_khanh` / `Sv@123456`.
2. Vào menu **Đơn xin bảo lưu đồ án** $ightarrow$ Nhập lý do điều trị y tế $ightarrow$ Đính kèm file **`07_Don_Xin_Bao_Luu_Do_An_Tot_Nghiep.pdf`** $ightarrow$ Bấm **Gửi đơn**.
3. Đăng nhập Admin: Vào menu **Xét duyệt đơn bảo lưu** $ightarrow$ Xem đơn và bấm **Chấp thuận bảo lưu** $ightarrow$ Đồ án chuyển sang trạng thái `DEFERRED`.

### 8. Bước 12 & 13: Hội đồng, Nhập điểm & Xuất báo cáo
1. Trên Web Admin, vào menu **Hội đồng bảo vệ**:
   - Xem cấu trúc Hội đồng 5 người (1 Chủ tịch, 2 Thư ký, 2 Ủy viên).
   - Kiểm tra GVHD không trùng trong Hội đồng chấm đồ án của sinh viên.
   - Xem lịch bảo vệ chi tiết từng slot.
2. Tại màn hình chấm điểm Hội đồng:
   - Các ủy viên nhập điểm thành phần $ightarrow$ Điểm tổng hợp được tự động tính thang 10 và quy đổi sang thang 4.0.
   - Bấm **Chốt điểm Hội đồng**.
   - Bấm **Xuất biên bản bảo vệ PDF** và **Xuất danh sách điểm theo lớp (Excel)**.
