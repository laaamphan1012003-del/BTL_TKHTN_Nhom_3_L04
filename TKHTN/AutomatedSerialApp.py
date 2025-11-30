import tkinter as tk
import util
import cv2
from PIL import Image, ImageTk
import os 
import subprocess  
import datetime 

# Import lớp điều khiển Serial đã được sửa đổi
from Serial_Com_ctrl import SerialCtrl

# <<< THIẾT LẬP CỔNG COM VÀ BAUD RATE MẶC ĐỊNH TẠI ĐÂY >>>
COM_PORT = 'COM4'  
BAUD_RATE = 115200

class App:
    def __init__(self):
        self.main_window = tk.Tk()
        self.main_window.title("Automated Access Control")
        self.main_window.geometry("1200x520+350+100")
        
        # --- GUI Components ---
        self.login_button_main_window = util.get_button(self.main_window, "Login", "green", self.login)
        self.login_button_main_window.place (x=750, y=300) 
        self.register_new_user_button_main_window = util.get_button(self.main_window, "Register New User", "gray", self.register_new_user, fg='black')
        self.register_new_user_button_main_window.place (x=750, y=400)
        self.webcam_label = util.get_img_label(self.main_window)
        self.webcam_label.place(x=10, y=0,width=700,height=500)
        
        # <<< THÊM VÀO: Nhãn trạng thái kết nối Serial >>>
        self.serial_status_label = tk.Label(self.main_window, text="Connecting to Serial Port...", font=("Helvetica", 12))
        self.serial_status_label.place(x=750, y=20)

        # --- Webcam and Database Setup ---
        self.add_webcam(self.webcam_label)
        self.db_dir = './db'
        if not os.path.exists(self.db_dir):
            os.makedirs(self.db_dir)
        self.log_path = './log.txt'
        
        # <<< THÊM VÀO: Tự động kết nối Serial khi khởi động >>>
        self.MySerial = SerialCtrl()
        self.MySerial.SerialOpen_Auto(COM_PORT, BAUD_RATE)
        self.update_serial_status()

        # Đảm bảo đóng cổng Serial khi tắt cửa sổ
        self.main_window.protocol("WM_DELETE_WINDOW", self.on_closing)

    def update_serial_status(self):
        if self.MySerial.ser.status:
            self.serial_status_label.config(text=f"Connected: {COM_PORT}", fg="green")
        else:
            self.serial_status_label.config(text=f"Disconnected: {COM_PORT}", fg="red")

    def create_and_send_frame(self, command, data_payload=b''):
        '''
        Hàm để tạo và gửi frame theo cấu trúc: FF CMD LEN DATA CHECKSUM FE
        '''
        SOF = 0xFF
        EOF = 0xFE
        
        length = len(data_payload)
        
        # Dữ liệu để tính checksum
        checksum_data = bytearray([command, length]) + data_payload
        
        # Tính checksum (tổng 8-bit)
        checksum = sum(checksum_data) & 0xFF
        
        # Tạo frame hoàn chỉnh
        frame = bytearray([SOF, command, length]) + data_payload + bytearray([checksum, EOF])
        
        print(f"Sending frame: {' '.join(f'{b:02X}' for b in frame)}")
        self.MySerial.SendData(frame)

    def login(self):
        self.login_button_main_window.config(state=tk.DISABLED)
        unknown_image_path = './.tmp.jpg'
        cv2.imwrite(unknown_image_path, self.most_recent_capture_arr)

        try:
            output = subprocess.check_output(['face_recognition', self.db_dir, unknown_image_path], stderr=subprocess.STDOUT)
            name = output.decode('utf-8').split(',')[1].strip()
        except Exception:
            name = "unknown_person"
            
        if name in ['no_persons_found', 'unknown_person']:
            util.msg_box("Login Failed", "Access Denied.")
            # <<< GỬI FRAME TỪ CHỐI (Giữ nguyên) >>>
            self.create_and_send_frame(command=0x00) 
        else:
            util.msg_box("Login Success", f"Welcome, {name}!\nAccess Granted.")
            with open(self.log_path, 'a') as f:
                f.write(f'{name},{datetime.datetime.now()}\n')
            
            # <<< GỬI FRAME XÁC NHẬN KÈM TÊN NGƯỜI DÙNG >>>
            # 1. Chuyển đổi tên từ String sang Bytes
            name_bytes = name.encode('utf-8') 
            
            # 2. Gửi frame với data_payload là tên người dùng
            self.create_and_send_frame(command=0x01, data_payload=name_bytes) 

        os.remove(unknown_image_path)
        self.login_button_main_window.config(state=tk.NORMAL)

    def on_closing(self):
        print("Closing application and serial port.")
        self.MySerial.SerialClose()
        self.main_window.destroy()

    # --- Các hàm khác giữ nguyên từ file main.py ---
    def add_webcam(self, label):
        if 'cap' not in self.__dict__: self.cap = cv2.VideoCapture(0)
        self._label = label 
        self.process_webcam()

    def process_webcam(self):
        ret,frame = self.cap.read()
        self.most_recent_capture_arr = frame
        img_ = cv2.cvtColor(self.most_recent_capture_arr, cv2.COLOR_BGR2RGB) 
        self.most_recent_capture_pil = Image.fromarray(img_) 
        imgtk = ImageTk.PhotoImage(image=self.most_recent_capture_pil) 
        self._label.imgtk = imgtk
        self._label.configure(image=imgtk)
        self._label.after(20, self.process_webcam)

    def register_new_user(self):
        self.register_new_user_window = tk.Toplevel(self.main_window)
        self.register_new_user_window.geometry("1200x520+370+120")
        self.accept_button_register_new_user_window = util.get_button(self.register_new_user_window, "Accept", "green", self.accept_register_new_user)
        self.accept_button_register_new_user_window.place (x=750, y=300)
        self.try_again_button_register_new_user_window = util.get_button(self.register_new_user_window, "Try Again", "red", self.try_again_register_new_user)
        self.try_again_button_register_new_user_window.place (x=750, y=400)
        self.capture_label = util.get_img_label(self.register_new_user_window)
        self.capture_label.place(x=10, y=0,width=700,height=500)
        self.add_img_to_label(self.capture_label)
        self.entry_text_register_new_user = util.get_entry_text(self.register_new_user_window)
        self.entry_text_register_new_user.place(x=750, y=150)
        self.text_label_register_new_user = util.get_text_label(self.register_new_user_window, "Enter your name:")
        self.text_label_register_new_user.place(x=750, y=70)

    def add_img_to_label(self, label):
         imgtk = ImageTk.PhotoImage(image=self.most_recent_capture_pil)
         label.imgtk = imgtk
         label.configure(image=imgtk)
         self.register_new_user_capture = self.most_recent_capture_arr.copy()

    def start(self): self.main_window.mainloop()
    
    def accept_register_new_user(self):
        name = self.entry_text_register_new_user.get(1.0,'end-1c').strip()
        if not name:
            util.msg_box("Error", "Name cannot be empty.")
            return
        cv2.imwrite(os.path.join(self.db_dir,f'{name}.jpg'), self.register_new_user_capture)    
        util.msg_box("Success", f"User '{name}' registered successfully")
        self.register_new_user_window.destroy()

    def try_again_register_new_user(self): self.register_new_user_window.destroy()


if __name__ == "__main__":
    app = App()
    app.start()