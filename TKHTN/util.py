import os
import tkinter as tk
from tkinter import messagebox
import datetime
import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim

# Import logger HTTP để gửi dữ liệu về Dashboard
try:
    from http_logger import send_log
except ImportError:
    def send_log(msg, source="FaceID"): pass


def get_button(window, text, color, command, fg='white'):
    button = tk.Button(
                        window,
                        text=text,
                        activebackground="black",
                        activeforeground="white",
                        fg=fg,
                        bg=color,
                        command=command,
                        height=2,
                        width=20,
                        font=('Helvetica bold', 20)
                    )

    return button


def get_img_label(window):
    label = tk.Label(window)
    label.grid(row=0, column=0)
    return label


def get_text_label(window, text):
    label = tk.Label(window, text=text)
    label.config(font=("sans-serif", 21), justify="left")
    return label


def get_entry_text(window):
    inputtxt = tk.Text(window,
                       height=2,
                       width=15, font=("Arial", 32))
    return inputtxt


def msg_box(title, description):
    messagebox.showinfo(title, description)


def msg_log(message):
    """
    Ghi log đa kênh: File txt, Console và Server Dashboard
    """
    # 1. Ghi vào file log.txt
    try:
        with open("log.txt", "a", encoding="utf-8") as f:
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"[{timestamp}] {message}\n")
    except Exception as e:
        print(f"Lỗi ghi file log: {e}")

    # 2. In ra console để debug
    print(f"[LOG]: {message}")

    # 3. Gửi sang Dashboard qua HTTP
    send_log(message)


def compare_images_ssim(img1, img2, threshold=0.5):
    """
    So sánh 2 ảnh dùng SSIM (Structural Similarity Index)
    Trả về True nếu ảnh giống nhau (similarity > threshold)
    """
    try:
        # Resize ảnh 2 về kích thước của ảnh 1
        if img1.shape != img2.shape:
            img2 = cv2.resize(img2, (img1.shape[1], img1.shape[0]))
        
        # Chuyển sang grayscale
        gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
        
        # Tính SSIM
        (score, diff) = ssim(gray1, gray2, full=True)
        
        return score, score >= threshold
    except Exception as e:
        msg_log(f"Lỗi compare_images_ssim: {e}")
        return 0, False


def compare_images_histogram(img1, img2, threshold=0.7):
    """
    So sánh 2 ảnh dùng Histogram
    Trả về True nếu ảnh giống nhau (similarity > threshold)
    """
    try:
        # Resize ảnh 2 về kích thước của ảnh 1
        if img1.shape != img2.shape:
            img2 = cv2.resize(img2, (img1.shape[1], img1.shape[0]))
        
        # Tính histogram cho mỗi channel
        hist1 = cv2.calcHist([img1], [0, 1, 2], None, [256, 256, 256], 
                             [0, 256, 0, 256, 0, 256])
        hist1 = cv2.normalize(hist1, hist1).flatten()
        
        hist2 = cv2.calcHist([img2], [0, 1, 2], None, [256, 256, 256], 
                             [0, 256, 0, 256, 0, 256])
        hist2 = cv2.normalize(hist2, hist2).flatten()
        
        # So sánh histogram
        score = cv2.compareHist(hist1, hist2, cv2.HISTCMP_BHATTACHARYYA)
        
        # Bhattacharyya distance: 0 = giống, 1 = khác
        # Nên ta dùng 1 - score để đảo ngược
        similarity = 1 - score
        
        return similarity, similarity >= threshold
    except Exception as e:
        msg_log(f"Lỗi compare_images_histogram: {e}")
        return 0, False


def recognize(img, db_path):
    """
    Nhận diện khuôn mặt bằng cách so sánh trực tiếp ảnh
    Không cần face_recognition
    """
    try:
        if img is None:
            msg_log("❌ Ảnh từ camera là None")
            return 'no_persons_found'
        
        msg_log(f"📷 Nhận ảnh từ camera - Shape: {img.shape}")
        
        # Duyệt qua tất cả các file ảnh trong folder db
        if not os.path.exists(db_path):
            msg_log(f"❌ Folder DB không tồn tại: {db_path}")
            return 'no_persons_found'

        db_files = [f for f in os.listdir(db_path) if f.endswith((".jpg", ".png", ".jpeg"))]
        msg_log(f"📁 Tìm thấy {len(db_files)} file ảnh trong DB")
        
        if len(db_files) == 0:
            msg_log("⚠️ Không có file ảnh nào trong folder DB")
            return 'unknown_person'
        
        best_match_name = 'unknown_person'
        best_match_score = 0
        method = 'histogram'  # Dùng histogram (nhanh hơn)

        for filename in db_files:
            path_ = os.path.join(db_path, filename)
            
            try:
                msg_log(f"🔎 Đang kiểm tra: {filename}")
                
                # Load ảnh từ DB
                db_image = cv2.imread(path_)
                if db_image is None:
                    msg_log(f"   ⚠️ Không thể load ảnh {filename}")
                    continue
                
                msg_log(f"   ✓ Load thành công (shape: {db_image.shape})")
                
                # So sánh ảnh
                if method == 'histogram':
                    similarity, is_match = compare_images_histogram(img, db_image, threshold=0.6)
                else:
                    similarity, is_match = compare_images_ssim(img, db_image, threshold=0.5)
                
                msg_log(f"   📏 Similarity: {similarity:.4f}")
                
                # Lưu best match
                if similarity > best_match_score:
                    best_match_score = similarity
                    best_match_name = os.path.splitext(filename)[0]
                    msg_log(f"   ⭐ New best match: {best_match_name} ({similarity:.4f})")
                    
                    if is_match:
                        msg_log(f"   ✅ MATCH!")
                        
            except Exception as e:
                msg_log(f"⚠️ Lỗi xử lý {filename}: {str(e)}")

        msg_log(f"\n{'='*60}")
        msg_log(f"📊 KẾT QUẢ:")
        msg_log(f"   Best match: {best_match_name}")
        msg_log(f"   Best score: {best_match_score:.4f}")
        msg_log(f"{'='*60}\n")
        
        if best_match_score >= 0.6:
            msg_log(f"✅ ✅ MATCH! Nhận diện: {best_match_name}")
            return best_match_name
        else:
            msg_log(f"❌ Score quá thấp ({best_match_score:.4f} < 0.6)")
            return 'unknown_person'
        
    except Exception as e:
        msg_log(f"❌ Lỗi: {str(e)}")
        import traceback
        traceback.print_exc()
        return 'unknown_person'

