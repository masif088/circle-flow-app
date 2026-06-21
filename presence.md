# Presensi Feature

## Role and Responsibilities

1. Admin
   - can view all presensi
   - can edit or delete any presensi
   - can export presensi data
   - can set up working hours
   2. Manager
   - can view all presensi dari timnya
   - can edit or delete any presensi dari timnya
   - can export presensi data dari timnya
   3. Employee
   - can view their own presensi
   - can add new presensi
   - can delete their own presensi

## Presence Data

1. Type of Presence
   a. Jam Kantor
   b. Keluar
   c. Cuti
   d. Izin
   e. Tugas Luar
   f. Sakit
   g. Libur
   h. Lainnya
2. Status
   a. Pending
   b. Approved
   c. Rejected

## Working Hours

1. Data Presence
   a. id
   b. user_id
   c. created_at
   d. type
   e. status
   f. description
   g. latitude
   h. longitude
   i. radius
   j. note
   k. approved_at
   l. approved_by
   m. approved_note
   n. rejected_at
   o. rejected_by
   p. rejected_note
   q. deleted_at
   r. deleted_by
   s. deleted_note
   u. updated_at
   city
   province
   country
   device_id
   device_type
   ip_address
   user_agent
   photo
   project_id
   cost_on_presence
   activity {
   uuid: {
   title:
   longitude:
   latitude:
   radius:
   photo:
   description:
   created_at:
   updated_at:
   user_id:
   project_id:
   status:
   }
   }

2. Project
   a. Title
   b. Location
   c. Company_id

3. Cost People on Project (ini untuk default cost people per day)
   project_id
   user_id
   cost

4. Company
   a. title
   b. description
   c. location
