# Product Rental API

ระบบ API สำหรับเว็บยืมสินค้า ใช้ Express และ MongoDB โดยมีหน้าเว็บทดสอบใน `index.html`

## เริ่มใช้งาน

1. ติดตั้ง MongoDB ในเครื่อง หรือสร้างฐานข้อมูลบน MongoDB Atlas
2. รัน `npm install`
3. คัดลอก `.env.example` เป็น `.env` แล้วใส่ `MONGODB_URI` และ `ADMIN_KEY`
4. รัน `npm start`
5. เปิด `http://localhost:3000`

ถ้าไม่ตั้ง `ADMIN_KEY` ระบบจะอนุญาตคำสั่งแอดมินเพื่อความสะดวกตอนพัฒนาเท่านั้น ควรตั้งค่าก่อนใช้งานจริง

## Endpoint หลัก

| Method | Path | หน้าที่ |
| --- | --- | --- |
| GET | `/api/health` | ตรวจสถานะ API และ MongoDB |
| GET | `/api/products` | ดูสินค้าที่เปิดใช้งาน |
| POST | `/api/products` | เพิ่มสินค้า ต้องส่ง header `x-admin-key` |
| PATCH | `/api/products/:id` | แก้ไขสินค้า ต้องส่ง header `x-admin-key` |
| DELETE | `/api/products/:id` | ปิดการแสดงสินค้าโดยเก็บประวัติไว้ ต้องส่ง header `x-admin-key` |
| POST | `/api/loans` | บันทึกการยืมและตัดจำนวนคงเหลือ |
| GET | `/api/loans` | ดูประวัติการยืม ต้องส่ง header `x-admin-key` |
| POST | `/api/loans/:id/return` | บันทึกคืนและเพิ่มจำนวนคงเหลือ |

ตัวอย่างข้อมูลสำหรับ `POST /api/loans`:

```json
{
  "productId": "รหัสสินค้า",
  "borrower": { "name": "สมชาย", "phone": "0812345678", "email": "somchai@example.com" },
  "quantity": 1,
  "dueDate": "2026-12-31"
}
```

การตัดสต็อกใช้คำสั่งแบบมีเงื่อนไข ทำให้ยืมเกินจำนวนพร้อมกันไม่ได้ และการลบสินค้าเป็น soft delete เพื่อรักษาประวัติรายการยืม
