# Danh mục chức năng cần kiểm thử - Hệ thống Quản lý Đồ án Tốt nghiệp

## 1. Nhóm chức năng cơ bản (Quy chuẩn 1 Test Case: Kiểm tra Happy Path)

- **Thiết lập đơn vị & nhân sự:** Thêm/sửa cơ cấu Khoa – Bộ môn – Giảng viên – Sinh viên[cite: 1].
- **Cập nhật hồ sơ GV:** Cập nhật hướng nghiên cứu và học vị (Tiến sĩ/Thạc sĩ)[cite: 1].
- **Tạo đợt đồ án:** Tạo mới đợt theo hệ Cử nhân hoặc Kỹ sư[cite: 1].
- **Sinh tài liệu PDF:** Tự động sinh file PDF đề cương đồ án đầy đủ các trường thông tin[cite: 1].
- **Ký nộp & Lưu đề cương:** SV nộp đề cương đã ký, hệ thống chuyển trạng thái lưu hồ sơ[cite: 1, 2].
- **Bảo lưu đề tài:** Tạo đơn bảo lưu khi không đủ điều kiện và Khoa phê duyệt[cite: 2].
- **Báo cáo cuối kỳ:** Xuất biên bản PDF, xuất dữ liệu cuối kỳ và in danh sách điểm theo lớp[cite: 2].

---

## 2. Nhóm chức năng phức tạp (Quy chuẩn 3 Test Cases: Happy Path, Boundary/Negative, Exception)

### 2.1. Import danh sách sinh viên & Phân loại CT[cite: 1]
- **TC1 (Happy Path):** Import file hợp lệ, tự động phân loại đúng Cử nhân / Kỹ sư[cite: 1].
- **TC2 (Negative):** Import file sai định dạng cột hoặc dữ liệu ngành không tồn tại (Hệ thống báo lỗi validate).
- **TC3 (Exception):** Trùng mã sinh viên hoặc thiếu trường bắt buộc (Rollback toàn bộ, báo lỗi dòng cụ thể).

### 2.2. Kiểm tra ràng buộc học vị GV tối thiểu (Kỹ sư vs Cử nhân)[cite: 1]
- **TC1 (Happy Path):** SV Kỹ sư chọn GV có học vị Tiến sĩ (Hợp lệ, lưu thành công)[cite: 1].
- **TC2 (Negative):** SV Kỹ sư chọn GV có học vị Thạc sĩ (Hệ thống chặn, báo không đạt điều kiện học vị)[cite: 1].
- **TC3 (Boundary):** SV Cử nhân chọn GV Thạc sĩ hoặc Tiến sĩ (Hợp lệ theo ngưỡng tối thiểu Thạc sĩ)[cite: 1].

### 2.3. Thuật toán tối ưu phân công GV (Capacity & Constraints)[cite: 1]
- **TC1 (Happy Path):** Phân công tự động thỏa mãn toàn bộ hard constraints và soft constraints (ưu tiên NV1, đúng hướng NC)[cite: 1].
- **TC2 (Boundary):** GV chạm ngưỡng quota/capacity tối đa -> Hệ thống tự động chuyển SV sang NV2/NV3 hợp lệ tiếp theo[cite: 1].
- **TC3 (Exception):** Khoa sử dụng quyền can thiệp thủ công (Review/Override) để phân bổ lại GV trái với đề xuất thuật toán[cite: 1].

### 2.4. Duyệt đề tài & Xử lý từ chối[cite: 1]
- **TC1 (Happy Path):** Khoa approve đề tài -> Đề tài chuyển sang trạng thái Approved, cho phép sinh đề cương[cite: 1].
- **TC2 (Negative):** Khoa từ chối đề tài và nhập lý do -> Đề tài bị trả về trạng thái yêu cầu sửa (Draft)[cite: 1].
- **TC3 (Exception):** Khoa click từ chối nhưng không nhập lý do -> Hệ thống chặn lại, hiển thị thông báo bắt buộc nhập lý do[cite: 1].

### 2.5. Xét điều kiện làm đồ án & Quyền Force Approve[cite: 2]
- **TC1 (Happy Path):** SV nợ < 10 tín chỉ -> Đủ điều kiện làm đồ án, hệ thống mở luồng giao task[cite: 2].
- **TC2 (Negative):** SV nợ >= 10 tín chỉ -> Bị loại khỏi đợt đồ án (nếu không có can thiệp)[cite: 2].
- **TC3 (Exception):** SV nợ >= 10 tín chỉ nhưng Quản trị viên sử dụng quyền `Force approve` -> Vẫn cho phép SV tiếp tục làm đề tài[cite: 2].

### 2.6. Quản lý Task & Đánh giá năng lực đồ án[cite: 2]
- **TC1 (Happy Path):** GV tạo task -> SV nộp kết quả -> GV review đánh giá Đạt -> Task chuyển trạng thái Hoàn thành[cite: 2].
- **TC2 (Negative):** GV review kết quả Không đạt -> Gửi yêu cầu sửa -> SV làm lại và nộp bổ sung[cite: 2].
- **TC3 (Exception):** SV trễ deadline task hoặc nộp sai định dạng (Kiểm tra validate file upload và cảnh báo trễ hạn).

### 2.7. Thành lập hội đồng & Ràng buộc phân bổ SV[cite: 2, 3]
- **TC1 (Happy Path):** Tạo hội đồng đủ chuẩn 5 thành viên (1 Chủ tịch, 2 Thư ký, 2 Ủy viên)[cite: 2].
- **TC2 (Negative):** Ràng buộc `GVHD != Thành viên Hội đồng` -> Hệ thống báo lỗi nếu gán SV vào hội đồng có GVHD ngồi chấm[cite: 2].
- **TC3 (Boundary):** Xếp lịch tự động -> Kiểm tra thuật toán đảm bảo giới hạn tải xếp đúng 10–12 SV trên mỗi buổi bảo vệ[cite: 3].

### 2.8. Nhập điểm & Xác nhận kết quả Hội đồng[cite: 2]
- **TC1 (Happy Path):** Toàn bộ thành viên HĐ nhập đủ điểm -> Hệ thống tự động tính điểm tổng hợp và chuyển trạng thái xác nhận[cite: 2].
- **TC2 (Negative):** Điểm số nhập ngoài dải cho phép (ví dụ: < 0 hoặc > 10) -> Hệ thống validate chặn lưu.
- **TC3 (Exception):** Thiếu điểm của 1 ủy viên hoặc thư ký -> Hệ thống giữ trạng thái chưa hoàn tất, không cho phép xuất biên bản cuối cùng[cite: 2].