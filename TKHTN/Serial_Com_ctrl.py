import serial
import serial.tools.list_ports

class SerialCtrl():
    def __init__(self):
        self.ser = serial.Serial()
        self.ser.status = False

    def SerialOpen_Auto(self, port, baud):
        '''
        Method to automatically open a serial port with given parameters.
        '''
        try:
            self.ser = serial.Serial(port=port, baudrate=baud, timeout=0.1)
            if self.ser.is_open:
                self.ser.status = True
                print(f"Successfully connected to {port} at {baud} BAUD.")
            else:
                self.ser.status = False
        except serial.SerialException as e:
            print(f"Error: Could not open serial port '{port}'. Please check the connection.")
            self.ser.status = False
            
    def SerialClose(self):
        '''
        Method to close the serial port.
        '''
        if self.ser.is_open:
            self.ser.close()
            self.ser.status = False

    def SendData(self, data):
        '''
        Method to send data over the serial port.
        '''
        if self.ser.status:
            self.ser.write(data)
            return True
        else:
            print("Cannot send data. Serial port is not open.")
            return False