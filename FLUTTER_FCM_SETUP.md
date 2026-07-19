# Flutter FCM Setup — Circle Flow

Paste prompt ini ke Claude di project Flutter kamu:

---

## Prompt untuk Claude (Flutter App)

Saya perlu setup **Firebase Cloud Messaging (FCM)** di Flutter app ini agar bisa menerima push notification dari Firebase Cloud Functions.

Yang perlu dilakukan:

### 1. Tambahkan dependency di `pubspec.yaml`
```yaml
dependencies:
  firebase_core: ^3.x.x
  firebase_messaging: ^15.x.x
  flutter_local_notifications: ^17.x.x  # untuk notif saat app foreground
```

### 2. Setup Android (`android/app/src/main/AndroidManifest.xml`)
Pastikan ada permission dan channel notifikasi:
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

<!-- Di dalam <application> -->
<meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="shift_reminder" />
```

Buat file `android/app/src/main/res/values/strings.xml` jika belum ada:
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="default_notification_channel_id">shift_reminder</string>
</resources>
```

### 3. Kode utama — simpan FCM token ke Firestore

Di file `main.dart` atau service class FCM kamu, tambahkan fungsi ini:

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class FcmService {
  static final _messaging = FirebaseMessaging.instance;

  static Future<void> initialize() async {
    // Minta permission
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Ambil token dan simpan ke Firestore
    await _saveToken();

    // Update token jika berubah
    _messaging.onTokenRefresh.listen(_saveFcmToken);

    // Handler notif saat app foreground
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handler notif saat app di-tap dari background/terminated
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);
  }

  static Future<void> _saveToken() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;

    final token = await _messaging.getToken();
    if (token == null) return;

    await FirebaseFirestore.instance.collection('users').doc(uid).update({
      'fcm_token': token,
    });
  }

  static Future<void> _saveFcmToken(String token) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;

    await FirebaseFirestore.instance.collection('users').doc(uid).update({
      'fcm_token': token,
    });
  }

  static void _handleForegroundMessage(RemoteMessage message) {
    // Tampilkan local notification saat app foreground
    // (opsional: pakai flutter_local_notifications)
    print('FCM foreground: ${message.notification?.title}');
  }

  static void _handleNotificationTap(RemoteMessage message) {
    final type = message.data['type'];
    final projectId = message.data['project_id'];
    // Navigate ke halaman project jika perlu
    print('Notification tapped: type=$type projectId=$projectId');
  }
}
```

### 4. Panggil di `main()` setelah login

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(MyApp());
}

// Di AuthStateChanges listener, setelah user login:
FirebaseAuth.instance.authStateChanges().listen((user) {
  if (user != null) {
    FcmService.initialize(); // simpan token setelah login
  }
});
```

### 5. Background message handler (wajib top-level function)

```dart
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('Background FCM: ${message.notification?.title}');
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  runApp(MyApp());
}
```

---

## Catatan penting

- FCM token disimpan di `users/{uid}/fcm_token` di Firestore — Cloud Functions sudah membaca field ini
- Channel ID yang dipakai adalah `shift_reminder` — harus sama dengan yang ada di `AndroidManifest.xml`
- Token otomatis diperbarui jika berubah via `onTokenRefresh`
- User dengan role `staff` yang punya `fcm_token` yang akan dapat notifikasi push

---

## Yang sudah disiapkan di backend (tidak perlu diubah)

- Cloud Function `fcmShiftReminder` berjalan setiap 30 menit (UTC)
- 30 menit sebelum `check_in_time` proyek → notif "Waktunya Masuk Kerja"
- 30 menit setelah `check_out_time` proyek → notif "Jangan Lupa Absen Pulang"
- Hanya dikirim ke staff yang terdaftar di jadwal (Gantt task) proyek hari itu
