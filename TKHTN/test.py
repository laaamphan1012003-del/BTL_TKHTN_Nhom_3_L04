import serial
import time

try:
    ser = serial.Serial('COM3',9600,timeout= 1)
    time.sleep(2)
    while True:
        # Đọc một dòng dữ liệu (kết thúc bằng ký tự '\n')
        line = ser.readline()
        if line:
            # Dữ liệu nhận được là dạng bytes, cần giải mã (decode) sang chuỗi ký tự
            # .strip() để loại bỏ các khoảng trắng hoặc ký tự không mong muốn ở đầu/cuối
            decoded_line = line.decode('utf-8').strip()
            print("Nhận được: " + decoded_line)

except serial.SerialException as e:
    print(f"Lỗi: Không thể mở cổng nối tiếp. {e}")
except KeyboardInterrupt:
    print("\nChương trình đã đóng.")
finally:
    if 'ser' in locals() and ser.is_open:
        ser.close()
        print("Đã đóng cổng nối tiếp.")
