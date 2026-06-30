-- สร้าง user และ database สำหรับ CCTV local dev
CREATE USER cctv_db WITH PASSWORD 'dev_local_password';
CREATE DATABASE cctv_db OWNER cctv_db;
GRANT ALL PRIVILEGES ON DATABASE cctv_db TO cctv_db;
