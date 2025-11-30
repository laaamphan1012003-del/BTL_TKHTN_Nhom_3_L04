#include <WiFi.h>
#include <WebServer.h>
#include <HardwareSerial.h>
#include <ArduinoJson.h> // Thư viện cần thiết để parse JSON từ Python App

// --- THAY ĐỔI THÔNG TIN WIFI CỦA BẠN TẠI ĐÂY ---
const char* ssid = "Can Tim Nguoi Yeu";
const char* password = "bamdaidiem";

// --- CẤU HÌNH GIAO TIẾP VỚI STM32F1 ---
// Sử dụng Serial1 (UART2) để giao tiếp với STM32F1
HardwareSerial Serial_STM32(1); // 1 = Serial1 (Hoặc 2 = Serial2)
const int STM32_BAUDRATE = 9600; 

// --- CẤU HÌNH SERVER HTTP ---
WebServer server(80); 

//LED
const int LED_PIN = 2; // Chọn GPIO Pin 2 hoặc pin bạn dùng
int ledState = LOW;

// Hàm chuyển đổi chuỗi Hex thành Byte Array
// Ví dụ: "FFA501014EFE" -> [0xFF, 0xA5, 0x01, 0x01, 0x4E, 0xFE]
void hexStringToBytes(const String& hex, byte* buffer, size_t& len) {
    len = 0;
    for (size_t i = 0; i < hex.length(); i += 2) {
        String byteString = hex.substring(i, i + 2);
        buffer[len++] = (byte) strtoul(byteString.c_str(), NULL, 16);
    }
}

void handleFrameReceive() {
  // Python App gửi JSON: {"frame": "FFA501014EFE..."}
  
  // FIX LỖI: Bỏ kiểm tra server.contentType() không tồn tại.
  if (server.method() != HTTP_POST) {
    server.send(405, "text/plain", "Method Not Allowed");
    return;
  }

  // --- 1. Lấy dữ liệu JSON ---
  // Dữ liệu JSON POST Body được truy cập thông qua server.arg("plain")
  StaticJsonDocument<500> doc;
  DeserializationError error = deserializeJson(doc, server.arg("plain"));

  if (error) {
    String errMsg = "Loi Parse JSON: " + String(error.c_str());
    Serial.println(errMsg);
    server.send(400, "application/json", "{\"success\": false, \"message\": \"" + errMsg + "\"}");
    return;
  }

  const char* hexFrame = doc["frame"];
  if (!hexFrame) {
    server.send(400, "application/json", "{\"success\": false, \"message\": \"Thieu truong 'frame'\"}");
    return;
  }
  
  String hexString(hexFrame);

  // --- 2. Chuyển đổi Hex String thành Byte Array ---
  byte frameBytes[256]; // Kích thước buffer tối đa 256 byte
  size_t frameLength; 
  hexStringToBytes(hexString, frameBytes, frameLength);

  // --- 3. Gửi Frame Byte qua UART tới STM32F1 ---
  Serial_STM32.write(frameBytes, frameLength);
  
  Serial.print("Da nhan Frame (");
  Serial.print(frameLength);
  Serial.print(" bytes) va chuyen tiep qua UART. Hex: ");
  Serial.println(hexString);

  // --- 4. Phản hồi thành công về Python App ---
  server.send(200, "application/json", "{\"success\": true, \"message\": \"Frame da gui qua UART den STM32F1\"}");
}

void handleLedStatus() {
  // Đọc trạng thái hiện tại của LED_PIN
  int currentStatus = digitalRead(LED_PIN); 
  // Phản hồi JSON
  int logicalStatus = (currentStatus == LOW) ? 1 : 0; // Đảo logic nếu LED là Active Low
  
  String response = "{\"success\": true, \"led_status\": " + String(logicalStatus) + "}";
  server.send(200, "application/json", response);
  Serial.print("API: Lay trang thai LED. Status="); Serial.println(logicalStatus);
}

void handleLedToggle() {
  if (server.method() != HTTP_POST ) {
    server.send(405, "text/plain", "Method Not Allowed or Invalid Content Type");
    return;
}

// Parse JSON {"status": 0 or 1}
  StaticJsonDocument<100> doc;
  DeserializationError error = deserializeJson(doc, server.arg("plain"));
  
  if (error || !doc.containsKey("status")) {
    String errMsg = "Loi Parse JSON/Thieu truong 'status': " + String(error.c_str());
    server.send(400, "application/json", "{\"success\": false, \"message\": \"" + errMsg + "\"}");
    return;
  }
  
  int newStatus = doc["status"].as<int>();
  
  // Đảo logic nếu LED là Active Low: 1 (ON) -> LOW, 0 (OFF) -> HIGH
  int physicalState = (newStatus == 1) ? LOW : HIGH;
  
  digitalWrite(LED_PIN, physicalState);
  
  Serial.print("API: Thay doi trang thai LED. New Status="); Serial.println(newStatus);
  server.send(200, "application/json", "{\"success\": true, \"message\": \"Da cap nhat trang thai LED\"}");
}

void setup() {
  Serial.begin(115200);
  delay(100);

  // Khởi tạo UART để giao tiếp với STM32F1
  // Pins: RX=16, TX=17. Baudrate phải khớp với STM32
  Serial_STM32.begin(STM32_BAUDRATE, SERIAL_8N1, 16, 17); 
  Serial.print("Khoi tao UART voi STM32F1 o Baudrate: ");
  Serial.println(STM32_BAUDRATE);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, ledState);

  // --- KẾT NỐI WIFI ---
  WiFi.begin(ssid, password);
  Serial.print("Dang ket noi toi WiFi.");

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nKet noi WiFi thanh cong.");
    Serial.print("Dia chi IP cua ESP32: ");
    Serial.println(WiFi.localIP());

    // --- CẤU HÌNH HTTP SERVER ---
    // Endpoint: /receive_frame (Phải khớp với ESP32_FRAME_URL trong Python)
    server.on("/receive_frame", HTTP_POST, handleFrameReceive);
    
    // ---LED Control APIs (từ Node.js Server)---
    server.on("/api/led/status", HTTP_GET, handleLedStatus);
    server.on("/api/led/toggle", HTTP_POST, handleLedToggle);

    server.onNotFound([](){
      server.send(404, "text/plain", "Not Found");
    });

    server.begin();
    Serial.println("Server HTTP khoi chay.");
  } else {
    Serial.println("\nLoi ket noi WiFi.");
  }
}

void loop() {
  server.handleClient(); // Xử lý các yêu cầu HTTP đến
  // Có thể thêm logic đọc phản hồi từ STM32F1 ở đây nếu cần thiết
}

