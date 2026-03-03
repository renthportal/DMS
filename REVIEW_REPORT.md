# DMS (Driver Monitoring System) - Kod Analiz Raporu

**Tarih:** 2026-03-03
**Analiz Eden:** Claude Code Review

---

## Proje Özeti

Tarayıcı tabanlı bir **Sürücü İzleme Sistemi (Driver Monitoring System)**. Kamera aracılığıyla sürücünün yüzünü ve ellerini gerçek zamanlı takip ederek uyuklama, dikkatsizlik, telefon kullanımı gibi tehlikeli davranışları tespit eder.

## Mimari ve Teknoloji Yığını

| Bileşen | Teknoloji |
|---|---|
| Yüz tespiti | MediaPipe FaceMesh v0.4 |
| El tespiti | MediaPipe Hands v0.4 |
| Telefon/Sigara tespiti | TensorFlow.js v4.10.0 + Özel YOLO modeli (~10MB) |
| AI Analiz API | Anthropic Claude (Haiku) |
| Nesne tespiti API | Roboflow API |
| Frontend | Tek dosya HTML (monolitik, 1144 satır) |
| Backend | Vercel serverless functions (api/) |

## Dosya Yapısı

```
DMS/
├── index.html          # Ana uygulama (HTML + CSS + JS monolitik)
├── api/
│   ├── analyze.js      # Anthropic Claude API proxy (serverless)
│   └── roboflow.js     # Roboflow API proxy (serverless)
└── model/
    ├── model.json       # YOLO model tanımı
    ├── group1-shard1of3.bin  # Model ağırlıkları (4MB)
    ├── group1-shard2of3.bin  # Model ağırlıkları (4MB)
    └── group1-shard3of3.bin  # Model ağırlıkları (2MB)
```

## Tespit Edilen Alarm Türleri

1. **UYUYOR** — Göz kapalılık süresi > 2.5sn (EAR tabanlı)
2. **YORGUN** — PERCLOS > %20 (60sn pencerede göz kapalılık oranı)
3. **ESNIYOR** — Ağız açıklık oranı (MAR) > 0.60, 2sn+
4. **UZAK BAKIŞ** — Göz iris sapması > 2sn
5. **DİKKATSİZ** — Baş eğimi (pitch/yaw) normal dışı > 3sn
6. **TELEFON** — YOLO model ile telefon tespiti veya el-kulak yakınlığı
7. **AYNA UZUN** — Yan ayna bakışı > 2sn

---

## Olumlu Yönler

1. **Otomatik kalibrasyon sistemi** — 150 örnek ile sürücüye özel EAR/pitch/yaw bazları oluşturuyor
2. **Çoklu tespit mekanizması** — Göz, ağız, baş, el, nesne tespiti bir arada çalışıyor
3. **Performans optimizasyonu** — Hands ayrı interval (300ms), YOLO ayrı interval (500ms)
4. **PERCLOS hesabı** — Bilimsel uyuklama metriği (60sn kayan pencere)
5. **Profesyonel UI** — Koyu tema, gerçek zamanlı metrik çubukları, alarm overlay sistemi
6. **Sesli uyarı** — Alarm türüne göre farklı beep paternleri

---

## Tespit Edilen Sorunlar

### 1. GÜVENLİK — KRİTİK

| Dosya | Satır | Sorun | Açıklama |
|---|---|---|---|
| `api/analyze.js` | 2 | CORS Open | `Access-Control-Allow-Origin: '*'` — herhangi bir domain'den API'ye istek atılabilir. ANTHROPIC_API_KEY kötüye kullanılabilir |
| `api/roboflow.js` | 2 | CORS Open | Aynı CORS sorunu. Herhangi biri Roboflow API anahtarını kullanabilir |
| `api/roboflow.js` | 15 | API Key in URL | API anahtarı query parametresinde gönderiliyor — loglanma/sızma riski |
| `api/analyze.js` | 18 | Prompt Injection | `req.body.system` doğrudan system prompt olarak gönderiliyor — doğrulama yok |
| `api/analyze.js` | 19 | Input Validation | `req.body.messages` hiçbir doğrulama yapılmadan API'ye gönderiliyor |

### 2. KOD KALİTESİ

| Dosya | Satır | Sorun | Açıklama |
|---|---|---|---|
| `index.html` | 371 | Çift style attribute | `<span id="fps-display" style="..." style="...">` — ikinci style yoksayılacak |
| `index.html` | 1-1144 | Monolitik yapı | HTML + CSS + JS tek dosyada. Bakımı ve genişletmesi zor |
| `index.html` | 364 | Inline Base64 | ~3KB base64 logo doğrudan HTML içinde |
| `index.html` | — | Global state | 20+ global değişken ile durum yönetimi |

### 3. PERFORMANS

| Dosya | Satır | Sorun | Açıklama |
|---|---|---|---|
| `index.html` | 829 | PERCLOS bar hesabı | `perclos * 100 / 30 * 100` formülü hatalı — doğrusu `(perclos / 0.30) * 100` |
| `index.html` | 987-990 | Race condition | `setInterval` ile Hands'e frame gönderimi — önceki çağrı bitmeden yeni çağrı yapılabilir |

### 4. FONKSİYONEL

| Dosya | Satır | Sorun | Açıklama |
|---|---|---|---|
| `api/analyze.js` | — | Kullanılmayan API | `index.html` içinde hiçbir yerde çağrılmıyor (dead code) |
| `api/roboflow.js` | — | Kullanılmayan API | Local YOLO modeline geçilmiş, API hala mevcut (dead code) |
| `index.html` | 671-672 | Dead code | `urgentTypes` dizisi tanımlanıp hiç kullanılmamış |
| `index.html` | 787 | Yanlış PERCLOS verisi | Yüz tespit edilemediğinde buffer'a `0` ekleniyor — PERCLOS'u yapay olarak düşürüyor |
| `index.html` | 857 | Sessiz hata yutma | Gaze hesabında `catch(e){}` — hata loglama yok |

### 5. UX / ERİŞİLEBİLİRLİK

- Sabit 340px sidebar, mobil cihazlarda kullanılamaz (responsive tasarım yok)
- Türkçe/İngilizce karışık kullanım
- Alarm sesleri sadece beep patternleri

### 6. BAĞIMLILIKLAR

- MediaPipe ve TensorFlow.js CDN üzerinden yükleniyor — CDN erişilemezse sistem çalışmaz
- Offline kullanım için service worker veya bundle mekanizması yok

---

## Öncelikli Aksiyon Planı

| Öncelik | Aksiyon |
|---|---|
| **P0 (Acil)** | CORS politikalarını sıkılaştırın, izin verilen origin'leri belirleyin |
| **P0 (Acil)** | API girdilerini doğrulayın (system prompt ve messages için sanitizasyon) |
| **P1 (Yüksek)** | Kullanılmayan API dosyalarını temizleyin veya `index.html` ile entegre edin |
| **P1 (Yüksek)** | Çift style attribute hatasını düzeltin (satır 371) |
| **P2 (Orta)** | PERCLOS bar hesaplama mantığını düzeltin (satır 829) |
| **P2 (Orta)** | Kodu modüler yapıya (CSS/JS ayrı dosyalar) dönüştürün |
| **P2 (Orta)** | Yüz tespit edilemediğinde PERCLOS buffer'a veri eklemeyi durdurun |
| **P3 (Düşük)** | Responsive tasarım ekleyin |
| **P3 (Düşük)** | Race condition'ı önlemek için Hands çağrısına kilit (mutex) ekleyin |
| **P3 (Düşük)** | CDN bağımlılıklarını bundle'layın veya fallback mekanizması ekleyin |
