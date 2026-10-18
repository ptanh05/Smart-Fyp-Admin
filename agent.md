# QUY CHUẨN PHÁT TRIỂN & CHỈ THỊ HOẠT ĐỘNG CHO AGENT (AGENT DIRECTIVES)

Hệ thống Quản lý Đồ án Tốt nghiệp Thông minh ThesisHub (UTC) bao gồm 2 kho mã nguồn (workspaces) liên kết chặt chẽ và dùng chung một cơ sở dữ liệu **Neon PostgreSQL**:
- `/smart-fyp-management`: Cổng thông tin Sinh viên & Giảng viên hướng dẫn (Client Portal).
- `/Smart-Fyp-Admin`: Cổng thông tin Quản trị viên Khoa & Ban chủ nhiệm (Admin Portal).

---

## 🚫 1. NGUYÊN TẮC BẤT BIẾN: CẤM TẠO THÊM BẢNG VÀO DATABASE (STRICT ZERO-NEW-TABLE POLICY)

> [!CAUTION]
> **ĐIỀU KHOẢN BẮT BUỘC ĐỐI VỚI MỌI AGENT:**
> Cơ sở dữ liệu đã được **CHỐT CỐ ĐỊNH VÀ ĐÓNG BĂNG (FROZEN SCHEMA)** với đúng **25 Models Nghiệp vụ Pure UTC Schema**.
> 
> ❌ **TUYỆT ĐỐI KHÔNG ĐƯỢC TẠO THÊM BẤT KỲ BẢNG MỚI NÀO NỮA!**
> - Không được tạo class `Model` mới trong `backend/app/models.py`.
> - Không được tạo hay chạy migration tạo bảng mới (`makemigrations` / `migrate` DDL CREATE TABLE).
> - Không được tạo bảng trung gian mới hoặc bảng phụ ngoài danh mục 25 bảng nghiệp vụ bên dưới.
> - Mọi tính năng nghiệp vụ mới hoặc logic mở rộng sau này **BẮT BUỘC PHẢI TẬN DỤNG VÀ ÁNH XẠ TRÊN 25 BẢNG ĐÃ CÓ SẴN**.

---

## 📋 2. DANH MỤC 25 BẢNG NGHIỆP VỤ CỐ ĐỊNH CHUẨN UTC

Toàn bộ hệ thống hoạt động hoàn toàn trên đúng 25 thực thể nghiệp vụ sau:

| STT | Tên bảng CSDL | Model Django | Phạm vi nghiệp vụ |
| :---: | :--- | :--- | :--- |
| **01** | `app_academicbatch` | `AcademicBatch` | Quản lý đợt đồ án tốt nghiệp, giai đoạn đợt |
| **02** | `app_department` | `Department` | Bộ môn quản lý (CNPM, HTTT, KHMT, MMT) |
| **03** | `app_projecttopicarea` | `ProjectTopicArea` | Hướng nghiên cứu & Lĩnh vực đề tài |
| **04** | `app_evaluationpolicy` | `EvaluationPolicy` | Quy chế trọng số điểm (GVHD 40% - GVPB 20% - HĐ 40%) |
| **05** | `app_customuser` | `CustomUser` | Tài khoản người dùng (Admin, GVHD, SV) |
| **06** | `app_courseclass` | `CourseClass` | Lớp học phần / Lớp sinh hoạt |
| **07** | `app_supervisor` | `Supervisor` | Thông tin giảng viên hướng dẫn & học vị |
| **08** | `app_supervisorquota` | `SupervisorQuota` | Hạn mức chỉ tiêu hướng dẫn theo hệ số học vị |
| **09** | `app_student` | `Student` | Thông tin sinh viên, CPA, hệ đào tạo Kỹ sư / Cử nhân |
| **10** | `app_studentpreference` | `StudentPreference` | Khảo sát 3 nguyện vọng giảng viên NV1, NV2, NV3 |
| **11** | `app_internshipinfo` | `InternshipInfo` | Thông tin khảo sát thực tập doanh nghiệp của SV |
| **12** | `app_graduationproject` | `GraduationProject` | Hồ sơ đề tài đồ án tốt nghiệp chính thức |
| **13** | `app_supervisionmeetinglog`| `SupervisionMeetingLog` | Nhật ký các buổi họp hướng dẫn định kỳ |
| **14** | `app_supervisiontask` | `SupervisionTask` | Nhiệm vụ / Task do GVHD giao cho sinh viên |
| **15** | `app_weeklyprogressreport`| `WeeklyProgressReport` | Báo cáo tiến độ đồ án nộp định kỳ hàng tuần |
| **16** | `app_thesisdeferralrequest`| `ThesisDeferralRequest` | Đơn xin bảo lưu đồ án của sinh viên |
| **17** | `app_outlinereviewgroup` | `OutlineReviewGroup` | Nhóm/tiểu ban duyệt đề cương |
| **18** | `app_outlinereview` | `OutlineReview` | Đánh giá & nhận xét đề cương đồ án |
| **19** | `app_defensecouncil` | `DefenseCouncil` | Hội đồng đánh giá bảo vệ đồ án (chuẩn UTC 5 người) |
| **20** | `app_councilmember` | `CouncilMember` | Thành viên hội đồng (1 Chủ tịch, 2 Thư ký, 2 Ủy viên) |
| **21** | `app_defensescheduleslot` | `DefenseScheduleSlot` | Lịch bảo vệ chi tiết từng slot (10-12 SV/buổi) |
| **22** | `app_councillivescore` | `CouncilLiveScore` | Điểm chấm trực tiếp của từng thành viên hội đồng |
| **23** | `app_finalgradesummary` | `FinalGradeSummary` | Tổng kết điểm cuối kỳ (thang 10, thang 4, điểm chữ) |
| **24** | `app_auditlog` | `AuditLog` | Nhật ký kiểm toán thao tác hệ thống |
| **25** | `app_notification` | `Notification` | Thông báo hệ thống cho người dùng |

*(Kèm theo 3 bảng Many-to-Many trung gian của Django: `app_customuser_groups`, `app_customuser_user_permissions`, `app_outlinereviewgroup_members` và các bảng hạ tầng mặc định của Django/SimpleJWT).*

---

## ⚙️ 3. QUY TẮC PHÁT TRIỂN & ĐỒNG BỘ HAI WORKSPACE

1. **Đồng bộ song hành Client & Admin**:
   - Khi sửa đổi logic hoặc tạo API mới ở Backend, phải kiểm tra và cập nhật giao diện React ở **CẢ HAI** thư mục (`smart-fyp-management` và `Smart-Fyp-Admin`).
   - Tuyệt đối không thêm tính năng ở Client mà bỏ quên màn hình quản lý ở Admin hoặc ngược lại.

2. **Dữ liệu mẫu & Xác thực**:
   - Giữ nguyên các tài khoản kiểm thử chuẩn đã xác thực (`admin`, `ts_thang`, `pgs_ha`, `ths_linh`, `sv_an`, `sv_hung`...).
   - Đảm bảo tính năng **1-Click Auto-Fill (Điền mẫu)** trên cả hai giao diện đăng nhập hoạt động trơn tru.

3. **Môi trường & Cổng chạy dịch vụ**:
   - Client Frontend: `http://localhost:3000`
   - Admin Frontend: `http://localhost:5174`
   - Client Backend: `http://localhost:8000`
   - Admin Backend: `http://localhost:8001`
   - Database: Neon PostgreSQL dùng chung qua biến môi trường `DATABASE_URL`.