# Duhoc Mate

PWA mobile-first cho du học sinh Việt tại Hàn Quốc.

## Features

- Tính lương việc làm thêm tại Hàn Quốc.
- So sánh với lương tối thiểu 2026: `10,320 KRW/giờ`.
- Tham chiếu mềm với mốc lương tháng trung bình tại Hàn Quốc.
- Đổi tỷ giá KRW/VND, có dữ liệu trực tiếp và tỷ giá mẫu dự phòng.
- Tìm bạn theo khu vực tại Hàn Quốc, gửi lời mời kết nối trước.
- Chuyển đổi giao diện tiếng Việt / tiếng Hàn.
- Hỗ trợ cài PWA và trang dự phòng khi ngoại tuyến.

## Run

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:4173`.

## Supabase

Cấu hình client nằm trong `.env.local` và chỉ dùng anon/public key.

Không đưa `service_role` key vào frontend. Chỉ dùng key đó ở môi trường server-side an toàn hoặc Supabase Edge Functions.

Chạy `supabase/schema.sql` trong Supabase SQL Editor để tạo bảng MVP và RLS policies.

## Product Notes

Tính năng so sánh lương chỉ mang tính tham khảo, không phải tư vấn pháp lý. App giúp người dùng biết mức lương giờ đang nhập thấp hơn, gần bằng, hay cao hơn lương tối thiểu, đồng thời so sánh tổng lương ước tính với một mốc tham chiếu quốc gia.
